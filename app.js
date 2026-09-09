const KEY = "control_empresarial_v4";

let db = load();

const $ = x => document.getElementById(x);

const today = () => new Date().toISOString().slice(0, 10);

function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "{}");

        return Object.assign({
            investments: [],
            products: [],
            sales: [],
            expenses: [],
            rates: {
                USD: 360,
                EUR: 390
            }
        }, saved);

    } catch (e) {

        return {
            investments: [],
            products: [],
            sales: [],
            expenses: [],
            rates: {
                USD: 360,
                EUR: 390
            }
        };
    }
}

function save() {
    localStorage.setItem(KEY, JSON.stringify(db));
    render();
}

function id() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2);
}

function inv(x) {
    return db.investments.find(i => i.id === x);
}

function prod(x) {
    return db.products.find(p => p.id === x);
}

function rate(c) {
    return c === "USD"
        ? +db.rates.USD
        : c === "EUR"
            ? +db.rates.EUR
            : 1;
}

function cup(v, c, r = rate(c)) {
    return +v * r;
}

function money(v) {
    return new Intl.NumberFormat("es-ES", {
        maximumFractionDigits: 2
    }).format(+v || 0) + " CUP";
}

function fmt(v, c) {
    return new Intl.NumberFormat("es-ES", {
        maximumFractionDigits: 2
    }).format(+v || 0) + " " + c;
}


/* =========================
   IDENTIFICADORES
========================= */

function normalizeCode(value) {
    return String(value ?? "").trim().toLowerCase();
}

function findProductByIdentifier(value) {

    const code = normalizeCode(value);

    if (!code) return null;

    return db.products.find(p => {

        return normalizeCode(p.barcode) === code ||
               normalizeCode(p.sku) === code ||
               normalizeCode(p.styleColor) === code ||
               normalizeCode(p.style) === code;

    }) || null;
}


/* =========================
   COSTO PUESTO
========================= */

function landed(p) {

    const i = inv(p.invId);

    if (!i)
        return cup(p.cost, p.cur);

    const ps = db.products.filter(x => x.invId === i.id);

    let ship = 0;

    if (i.alloc === "qty") {

        ship =
            i.ship /
            (ps.reduce((a, x) => a + x.qty, 0) || 1);

    } else {

        const total =
            ps.reduce(
                (a, x) => a + x.cost * x.qty,
                0
            ) || 1;

        ship =
            i.ship *
            (p.cost * p.qty / total) /
            p.qty;
    }

    return cup(p.cost, p.cur) +
        cup(
            ship,
            i.cur,
            i.rateSnapshot || rate(i.cur)
        );
}


/* =========================
   RECUPERACIÓN
========================= */

function rec(i) {

    let r = 0;
    let date = null;

    db.sales
        .filter(
            s =>
                inv(
                    prod(s.prodId)?.invId
                )?.id === i.id
        )
        .sort(
            (a, b) =>
                a.date.localeCompare(b.date)
        )
        .forEach(s => {

            const p = prod(s.prodId);

            if (!p) return;

            r += landed(p) * s.qty;

            if (
                !date &&
                r >= cup(
                    i.total,
                    i.cur,
                    i.rateSnapshot || rate(i.cur)
                )
            ) {
                date = s.date;
            }
        });

    const target =
        cup(
            i.total,
            i.cur,
            i.rateSnapshot || rate(i.cur)
        );

    return {
        r,
        target,
        date,
        pct: target
            ? Math.min(100, r / target * 100)
            : 0
    };
}


/* =========================
   MÉTRICAS
========================= */

function metrics() {

    const invested =
        db.investments.reduce(
            (a, i) =>
                a +
                cup(
                    i.total,
                    i.cur,
                    i.rateSnapshot || rate(i.cur)
                ),
            0
        );

    const sales =
        db.sales.reduce(
            (a, s) =>
                a +
                cup(
                    s.price * s.qty,
                    s.cur,
                    s.rateSnapshot || rate(s.cur)
                ),
            0
        );

    const cost =
        db.sales.reduce(
            (a, s) => {

                const p = prod(s.prodId);

                return a +
                    (p
                        ? landed(p) * s.qty
                        : 0);
            },
            0
        );

    const expenses =
        db.expenses.reduce(
            (a, e) =>
                a +
                cup(
                    e.amt,
                    e.cur,
                    e.rateSnapshot || rate(e.cur)
                ),
            0
        );

    return {
        invested,
        sales,
        cost,
        expenses,
        gross: sales - cost,
        net: sales - cost - expenses
    };
}


/* =========================
   NAVEGACIÓN
========================= */

function nav(p) {

    document
        .querySelectorAll("main>section")
        .forEach(
            s => s.classList.add("hidden")
        );

    $(p).classList.remove("hidden");

    document
        .querySelectorAll("nav button")
        .forEach(
            b =>
                b.classList.toggle(
                    "active",
                    b.dataset.p === p
                )
        );

    $("title").textContent = {

        dashboard: "Resumen financiero",
        investments: "Inversiones",
        inventory: "Inventario",
        sales: "Ventas",
        expenses: "Gastos",
        reports: "Reportes",
        settings: "Ajustes"

    }[p];
}

document
    .querySelectorAll("nav button")
    .forEach(
        b =>
            b.onclick = () =>
                nav(b.dataset.p)
    );

$("quick").onclick = () =>
    nav("sales");


/* =========================
   INVERSIONES
========================= */

$("if").onsubmit = e => {

    e.preventDefault();

    const c = $("icur").value;

    db.investments.push({

        id: id(),

        name: $("iname").value,

        date:
            $("idate").value ||
            today(),

        cur: c,

        merch:
            +$("imerch").value,

        ship:
            +$("iship").value,

        total:
            +$("imerch").value +
            (+$("iship").value || 0),

        alloc:
            $("ialloc").value,

        rateSnapshot:
            rate(c)
    });

    e.target.reset();

    $("idate").value = today();

    save();
};


/* =========================
   PRODUCTOS
========================= */

$("pf").onsubmit = e => {

    e.preventDefault();

    const styleColor =
        $("pstyle").value.trim();

    const sku =
        $("psku").value.trim();

    const barcode =
        $("pbar").value.trim();

    db.products.push({

        id: id(),

        name:
            $("pname").value.trim(),

        invId:
            $("pinv").value,

        styleColor,

        sku,

        barcode,

        qty:
            +$("pqty").value,

        stock:
            +$("pqty").value,

        cost:
            +$("pcost").value,

        price:
            +$("pprice").value,

        cur:
            $("pcur").value
    });

    e.target.reset();

    save();
};


/* =========================
   SELECCIÓN DE PRODUCTO
========================= */

$("sprod").onchange = () => {

    const p =
        prod($("sprod").value);

    if (!p) return;

    $("sprice").value =
        p.price;

    $("scur").value =
        p.cur;

    preview();
};


/* =========================
   BÚSQUEDA POR IDENTIFICADOR
========================= */

function searchProductByIdentifier() {

    const value =
        $("sbar").value.trim();

    if (!value) {

        preview();

        return;
    }

    const p =
        findProductByIdentifier(value);

    if (!p) {

        $("preview").textContent =
            "❌ No hay ningún producto registrado con ese identificador.";

        return;
    }

    $("sprod").value =
        p.id;

    $("sprod").dispatchEvent(
        new Event("change")
    );

    $("preview").textContent =
        "✓ Producto encontrado: " +
        p.name +
        " · Stock: " +
        p.stock;
}

$("sbar").addEventListener(
    "input",
    searchProductByIdentifier
);

$("sbar").addEventListener(
    "change",
    searchProductByIdentifier
);


/* =========================
   PREVISUALIZACIÓN DE VENTA
========================= */

$("sq").oninput =
    preview;

$("sprice").oninput =
    preview;

function preview() {

    const p =
        prod($("sprod").value);

    if (!p) {

        $("preview").textContent = "";

        return;
    }

    const q =
        +$("sq").value || 1;

    const revenue =
        cup(
            (+$("sprice").value || 0) * q,
            $("scur").value
        );

    const cost =
        landed(p) * q;

    $("preview").textContent =
        `Stock: ${p.stock} · ` +
        `Costo puesto: ${money(cost)} · ` +
        `Ganancia estimada: ${money(revenue - cost)}`;
}


/* =========================
   VENTAS
========================= */

$("sf").onsubmit = e => {

    e.preventDefault();

    const p =
        prod($("sprod").value);

    const q =
        +$("sq").value;

    if (!p) {

        alert("Selecciona un producto.");

        return;
    }

    if (q < 1) {

        alert("La cantidad debe ser mayor que cero.");

        return;
    }

    if (q > p.stock) {

        alert(
            "No hay suficiente stock."
        );

        return;
    }

    const c =
        $("scur").value;

    db.sales.push({

        id: id(),

        date:
            $("sdate").value ||
            today(),

        prodId:
            p.id,

        qty: q,

        price:
            +$("sprice").value,

        cur: c,

        pay:
            $("spay").value,

        rateSnapshot:
            rate(c)
    });

    p.stock -= q;

    e.target.reset();

    $("sdate").value =
        today();

    $("sbar").value = "";

    save();
};


/* =========================
   GASTOS
========================= */

$("ef").onsubmit = e => {

    e.preventDefault();

    const c =
        $("ecur").value;

    db.expenses.push({

        id: id(),

        date:
            $("edate").value ||
            today(),

        desc:
            $("edesc").value,

        amt:
            +$("eamt").value,

        cur: c,

        rateSnapshot:
            rate(c)
    });

    e.target.reset();

    $("edate").value =
        today();

    save();
};


/* =========================
   TASAS
========================= */

$("rf").onsubmit = e => {

    e.preventDefault();

    db.rates.USD =
        +$("rusd").value ||
        db.rates.USD;

    db.rates.EUR =
        +$("reur").value ||
        db.rates.EUR;

    save();
};


/* =========================
   TABLAS
========================= */

function table(x) {

    return `
        <div class="table">
            <table>${x}</table>
        </div>
    `;
}


/* =========================
   RENDER
========================= */

function render() {

    const m =
        metrics();

    $("balance").textContent =
        money(
            Math.max(
                0,
                m.sales - m.expenses
            )
        );

    $("recovered").textContent =
        money(
            Math.min(
                m.invested,
                m.cost
            )
        );

    $("invested").textContent =
        money(m.invested);

    $("sales").textContent =
        money(m.sales);

    $("cost").textContent =
        money(m.cost);

    $("gross").textContent =
        money(m.gross);

    $("expenses").textContent =
        money(m.expenses);

    $("net").textContent =
        money(m.net);

    $("rusd").value =
        db.rates.USD;

    $("reur").value =
        db.rates.EUR;


    /* Inversiones */

    $("pinv").innerHTML =
        db.investments
            .map(
                i =>
                    `<option value="${i.id}">
                        ${i.name}
                    </option>`
            )
            .join("")
        ||
        "<option value=''>Crea una inversión</option>";


    /* Productos */

    $("sprod").innerHTML =
        db.products
            .map(
                p =>
                    `<option value="${p.id}">
                        ${p.name} — ${p.stock}
                    </option>`
            )
            .join("")
        ||
        "<option value=''>Sin productos</option>";

    if (db.products.length) {

        $("sprod").dispatchEvent(
            new Event("change")
        );
    }


    /* Tabla inversiones */

    $("it").innerHTML =
        db.investments.length

            ? table(

                "<tr>" +
                "<th>Referencia</th>" +
                "<th>Total</th>" +
                "<th>Recuperación</th>" +
                "<th>Estado</th>" +
                "</tr>" +

                db.investments
                    .map(i => {

                        const r =
                            rec(i);

                        return `
                        <tr>
                            <td>${i.name}</td>
                            <td>${fmt(i.total, i.cur)}</td>
                            <td>
                                ${r.pct.toFixed(1)}%
                                <div class="progress">
                                    <i style="width:${r.pct}%"></i>
                                </div>
                            </td>
                            <td>
                                ${
                                    r.date
                                        ? "Recuperada " + r.date
                                        : "Pendiente"
                                }
                            </td>
                        </tr>
                        `;
                    })
                    .join("")
            )

            : "<p class='hint'>No hay inversiones.</p>";


    /* Tabla inventario */

    $("pt").innerHTML =
        db.products.length

            ? table(

                "<tr>" +
                "<th>Producto</th>" +
                "<th>Estilo / Color</th>" +
                "<th>SKU</th>" +
                "<th>Stock</th>" +
                "<th>Costo puesto</th>" +
                "<th>Precio</th>" +
                "<th>Código de barras</th>" +
                "</tr>" +

                db.products
                    .map(p => `

                    <tr>

                        <td>
                            ${p.name}
                        </td>

                        <td>
                            ${p.styleColor || p.style || "—"}
                        </td>

                        <td>
                            ${p.sku || "—"}
                        </td>

                        <td>
                            ${p.stock}/${p.qty}
                        </td>

                        <td>
                            ${money(landed(p))}
                        </td>

                        <td>
                            ${fmt(p.price, p.cur)}
                        </td>

                        <td>
                            ${p.barcode || "—"}
                        </td>

                    </tr>

                    `)
                    .join("")
            )

            : "<p class='hint'>No hay productos.</p>";


    /* Historial ventas */

    $("st").innerHTML =
        db.sales.length

            ? table(

                "<tr>" +
                "<th>Fecha</th>" +
                "<th>Producto</th>" +
                "<th>Cant.</th>" +
                "<th>Venta</th>" +
                "<th>Costo</th>" +
                "<th>Ganancia</th>" +
                "<th>Cobro</th>" +
                "</tr>" +

                db.sales
                    .slice()
                    .reverse()
                    .map(s => {

                        const p =
                            prod(s.prodId);

                        const rev =
                            cup(
                                s.price * s.qty,
                                s.cur,
                                s.rateSnapshot
                            );

                        const co =
                            p
                                ? landed(p) * s.qty
                                : 0;

                        return `

                        <tr>

                            <td>
                                ${s.date}
                            </td>

                            <td>
                                ${p?.name || "—"}
                            </td>

                            <td>
                                ${s.qty}
                            </td>

                            <td>
                                ${fmt(
                                    s.price * s.qty,
                                    s.cur
                                )}
                            </td>

                            <td>
                                ${money(co)}
                            </td>

                            <td>
                                ${money(rev - co)}
                            </td>

                            <td>
                                ${s.pay}
                            </td>

                        </tr>

                        `;
                    })
                    .join("")
            )

            : "<p class='hint'>No hay ventas.</p>";


    /* Gastos */

    $("et").innerHTML =
        db.expenses.length

            ? table(

                "<tr>" +
                "<th>Fecha</th>" +
                "<th>Concepto</th>" +
                "<th>Importe</th>" +
                "<th>CUP</th>" +
                "</tr>" +

                db.expenses
                    .slice()
                    .reverse()
                    .map(e => `

                    <tr>

                        <td>
                            ${e.date}
                        </td>

                        <td>
                            ${e.desc}
                        </td>

                        <td>
                            ${fmt(e.amt, e.cur)}
                        </td>

                        <td>
                            ${money(
                                cup(
                                    e.amt,
                                    e.cur,
                                    e.rateSnapshot
                                )
                            )}
                        </td>

                    </tr>

                    `)
                    .join("")
            )

            : "<p class='hint'>No hay gastos.</p>";


    /* Recuperación */

    $("recovery").innerHTML =
        db.investments
            .map(i => {

                const r =
                    rec(i);

                return `

                <div style="padding:10px 0">

                    <b>${i.name}</b>

                    <span style="float:right">
                        ${r.pct.toFixed(1)}%
                    </span>

                    <div class="progress">
                        <i style="width:${r.pct}%"></i>
                    </div>

                    <small>
                        ${
                            r.date
                                ? "Recuperada " + r.date
                                : "Pendiente"
                        }
                    </small>

                </div>

                `;
            })
            .join("")
        ||
        "<p class='hint'>No hay inversiones.</p>";


    /* Ventas recientes */

    $("recent").innerHTML =
        db.sales
            .slice()
            .reverse()
            .slice(0, 5)
            .map(s => `

                <div class="recent">

                    <span>
                        ${prod(s.prodId)?.name || "—"}

                        <small>
                            ${s.date}
                        </small>
                    </span>

                    <b>
                        ${money(
                            cup(
                                s.price * s.qty,
                                s.cur,
                                s.rateSnapshot
                            )
                        )}
                    </b>

                </div>

            `)
            .join("")
        ||
        "<p class='hint'>No hay ventas.</p>";


    /* Gráfico */

    const days = [];

    for (
        let n = 13;
        n >= 0;
        n--
    ) {

        let d =
            new Date();

        d.setDate(
            d.getDate() - n
        );

        days.push(
            d.toISOString().slice(0, 10)
        );
    }

    const vals =
        days.map(
            d =>
                db.sales
                    .filter(
                        s =>
                            s.date === d
                    )
                    .reduce(
                        (a, s) =>
                            a +
                            cup(
                                s.price * s.qty,
                                s.cur,
                                s.rateSnapshot
                            ),
                        0
                    )
        );

    const mx =
        Math.max(...vals, 1);

    $("chart").innerHTML =
        vals
            .map(
                v =>
                    `<div class="bar" style="height:${Math.max(
                        2,
                        v / mx * 90
                    )}%"></div>`
            )
            .join("");


    /* Reportes */

    $("reportsBox").innerHTML = `

        <div class="kpis">

            <article>
                Margen bruto
                <b>
                    ${
                        m.sales
                            ? (
                                m.gross /
                                m.sales *
                                100
                            ).toFixed(1)
                            : 0
                    }%
                </b>
            </article>

            <article>
                Capital pendiente
                <b>
                    ${money(
                        Math.max(
                            0,
                            m.invested -
                            m.cost
                        )
                    )}
                </b>
            </article>

            <article>
                Ganancia neta
                <b>
                    ${money(m.net)}
                </b>
            </article>

        </div>

    `;
}


/* =========================
   EXPORTAR
========================= */

$("export").onclick = () => {

    const a =
        document.createElement("a");

    a.href =
        URL.createObjectURL(
            new Blob(
                [
                    JSON.stringify(
                        db,
                        null,
                        2
                    )
                ],
                {
                    type:
                        "application/json"
                }
            )
        );

    a.download =
        "control_empresarial_respaldo.json";

    a.click();
};


/* =========================
   IMPORTAR
========================= */

$("import").onchange = e => {

    const r =
        new FileReader();

    r.onload = () => {

        try {

            db =
                JSON.parse(
                    r.result
                );

            save();

        } catch (_) {

            alert(
                "JSON inválido"
            );
        }
    };

    r.readAsText(
        e.target.files[0]
    );
};


/* =========================
   BORRAR
========================= */

$("clear").onclick = () => {

    if (
        confirm(
            "¿Borrar todos los datos?"
        )
    ) {

        localStorage.removeItem(
            KEY
        );

        location.reload();
    }
};


/* =========================
   FECHAS INICIALES
========================= */

[
    "idate",
    "sdate",
    "edate"
].forEach(
    x => $(x).value = today()
);


/* =========================
   INICIAR
========================= */

render();
