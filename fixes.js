/* Control Empresarial v1.5 — acciones y ventas robustas, diálogos propios (sin prompt/confirm) */
(function(){
  'use strict';

  const originalRender = window.render;
  const originalNav = window.nav;
  const makeId = window.uid || function(){ return Date.now().toString(36)+Math.random().toString(36).slice(2); };

  // Estilos para los botones de fila y el estado de venta
  const css=document.createElement('style');
  css.textContent=`
    .section-head{display:none!important}
    #quick.action-hidden{display:none!important}
    .row-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
    .row-action{border:1px solid var(--line);background:var(--card2);color:var(--blue);border-radius:9px;padding:7px 10px;font-size:10px;font-weight:800;cursor:pointer}
    .row-action.danger-action{color:var(--bad)}
    .sale-status{margin-top:8px;font-size:12px;font-weight:700}
    .sale-status.ok{color:var(--good)}.sale-status.error{color:var(--bad)}
  `;
  document.head.appendChild(css);

  // Botón de acción rápida (+) del encabezado, según la sección activa
  function setQuick(page){
    const q=document.getElementById('quick'); if(!q)return;
    const actions={
      dashboard:['＋','Registrar venta',()=>nav('sales')],
      investments:['＋','Nueva inversión',()=>togglePanel('investmentForm')],
      inventory:['＋','Agregar producto',()=>togglePanel('productForm')],
      expenses:['＋','Nuevo gasto',()=>togglePanel('expenseForm')]
    };
    const a=actions[page];
    if(!a){q.classList.add('action-hidden');q.onclick=null;return;}
    q.classList.remove('action-hidden');q.textContent=a[0];q.setAttribute('aria-label',a[1]);q.title=a[1];q.onclick=a[2];
  }
  window.nav=function(page){originalNav(page);setQuick(page)};

  // Diálogos propios (reemplazan prompt()/confirm() del navegador)
  function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}
  function dlg(title,sub,html,saveFn,danger){
    document.querySelectorAll('.ce-modal').forEach(x=>x.remove());
    const w=document.createElement('div');
    w.className='ce-modal';
    w.innerHTML='<div class="ce-dialog"><h3>'+title+'</h3><p>'+sub+'</p>'+html+'<div class="ce-actions"><button type="button" class="ce-cancel">Cancelar</button><button type="button" class="'+(danger?'ce-danger':'ce-primary')+' ce-save">'+(danger?'Eliminar':'Guardar')+'</button></div></div>';
    document.body.appendChild(w);
    w.querySelector('.ce-cancel').onclick=function(){w.remove()};
    w.querySelector('.ce-save').onclick=function(){if(saveFn(w)!==false)w.remove()};
    return w;
  }

  window.editInvestment=function(id){
    const i=db.investments.find(x=>x.id===id); if(!i)return;
    dlg('Editar inversión','Modifica todos los datos del pedido.',
      '<div class="ce-grid">'
        +'<label>Referencia<input id="ei_name" value="'+esc(i.name)+'"></label>'
        +'<label>Fecha<input id="ei_date" type="date" value="'+esc(i.date||today())+'"></label>'
        +'<label>Moneda<select id="ei_cur"><option '+(i.cur==='USD'?'selected':'')+'>USD</option><option '+(i.cur==='EUR'?'selected':'')+'>EUR</option><option '+(i.cur==='CUP'?'selected':'')+'>CUP</option></select></label>'
        +'<label>Mercancía<input id="ei_merch" type="number" min="0" step=".01" value="'+esc(i.merch??0)+'"></label>'
        +'<label>Envío<input id="ei_ship" type="number" min="0" step=".01" placeholder="Pendiente" value="'+(i.ship==null?'':esc(i.ship))+'"></label>'
        +'<label>Prorrateo<select id="ei_alloc"><option value="value" '+(i.alloc==='value'?'selected':'')+'>Por valor</option><option value="qty" '+(i.alloc==='qty'?'selected':'')+'>Por unidades</option></select></label>'
      +'</div>',
      function(w){
        const cur=w.querySelector('#ei_cur').value;
        const merch=Math.max(0,+w.querySelector('#ei_merch').value||0);
        const raw=w.querySelector('#ei_ship').value.trim();
        i.name=w.querySelector('#ei_name').value.trim()||i.name;
        i.date=w.querySelector('#ei_date').value||i.date;
        i.cur=cur;
        i.merch=merch;
        i.ship=raw===''?null:Math.max(0,+raw||0);
        i.total=merch+(i.ship==null?0:i.ship);
        i.alloc=w.querySelector('#ei_alloc').value;
        i.rateSnapshot=rate(cur);
        save();
      });
  };

  window.editProduct=function(id){
    const p=db.products.find(x=>x.id===id); if(!p)return;
    dlg('Editar producto','Modifica nombre, identificadores, cantidades y precios.',
      '<div class="ce-grid">'
        +'<label>Producto<input id="ep_name" value="'+esc(p.name)+'"></label>'
        +'<label>Estilo / Color<input id="ep_style" value="'+esc(p.style)+'"></label>'
        +'<label>SKU<input id="ep_sku" value="'+esc(p.sku)+'"></label>'
        +'<label>Código de barras<input id="ep_bar" value="'+esc(p.barcode)+'"></label>'
        +'<label>Cantidad total<input id="ep_qty" type="number" min="1" value="'+esc(p.qty)+'"></label>'
        +'<label>Costo unitario<input id="ep_cost" type="number" min="0" step=".01" value="'+esc(p.cost)+'"></label>'
        +'<label>Precio de venta<input id="ep_price" type="number" min="0" step=".01" value="'+esc(p.price)+'"></label>'
        +'<label>Moneda<select id="ep_cur"><option '+(p.cur==='USD'?'selected':'')+'>USD</option><option '+(p.cur==='EUR'?'selected':'')+'>EUR</option><option '+(p.cur==='CUP'?'selected':'')+'>CUP</option></select></label>'
      +'</div>',
      function(w){
        const sold=Math.max(0,(+p.qty||0)-(+p.stock||0));
        const qty=Math.max(1,+w.querySelector('#ep_qty').value||1);
        if(qty<sold){alert('La cantidad total no puede ser menor que las unidades ya vendidas: '+sold);return false;}
        p.name=w.querySelector('#ep_name').value.trim()||p.name;
        p.style=w.querySelector('#ep_style').value.trim();
        p.sku=w.querySelector('#ep_sku').value.trim();
        p.barcode=w.querySelector('#ep_bar').value.trim();
        p.qty=qty;
        p.stock=qty-sold;
        p.cost=Math.max(0,+w.querySelector('#ep_cost').value||0);
        p.price=Math.max(0,+w.querySelector('#ep_price').value||0);
        p.cur=w.querySelector('#ep_cur').value;
        save();
      });
  };

  window.deleteProduct=function(id){
    const p=db.products.find(x=>x.id===id); if(!p)return;
    const hasSales=db.sales.some(s=>s.prodId===id);
    dlg('Eliminar producto','Esta acción no se puede deshacer.',
      '<p>Se eliminará <b>'+esc(p.name)+'</b> del inventario.'+(hasSales?' Sus ventas también serán eliminadas del historial.':'')+'</p>',
      function(){
        db.products=db.products.filter(x=>x.id!==id);
        if(hasSales)db.sales=db.sales.filter(s=>s.prodId!==id);
        save();
      },true);
  };

  // Agrega los botones Editar/Eliminar a cada fila, una sola vez por fila
  function decorate(){
    const it=document.querySelector('#it table');
    if(it){
      const rows=it.querySelectorAll('tbody tr');
      rows.forEach(function(r,n){
        if(r.querySelector('.row-actions'))return;
        const i=db.investments[n]; if(!i)return;
        const c=document.createElement('td');
        c.innerHTML='<div class="row-actions"><button type="button" class="row-action">Editar</button></div>';
        c.querySelector('button').onclick=function(){editInvestment(i.id)};
        r.appendChild(c);
        if(i.ship==null && r.children[1]) r.children[1].innerHTML=fmt(i.merch,i.cur)+'<br><small style="color:var(--muted)">Envío pendiente</small>';
      });
      const h=it.querySelector('thead tr');
      if(h&&!h.querySelector('.actions-head')){const th=document.createElement('th');th.className='actions-head';th.textContent='Acciones';h.appendChild(th);}
    }
    const pt=document.querySelector('#pt table');
    if(pt){
      const q=(document.getElementById('inventorySearch')?.value||'').trim().toLowerCase();
      const low=document.getElementById('stockFilter')?.classList.contains('active');
      const ps=db.products.filter(function(p){
        return (!q||[p.name,p.sku,p.style,p.barcode].some(function(v){return String(v||'').toLowerCase().includes(q)}))
          && (!low||Number(p.stock)<=2);
      });
      const rows=pt.querySelectorAll('tbody tr');
      rows.forEach(function(r,n){
        if(r.querySelector('.row-actions'))return;
        const p=ps[n]; if(!p)return;
        const c=document.createElement('td');
        c.innerHTML='<div class="row-actions"><button type="button" class="row-action">Editar</button><button type="button" class="row-action danger-action">Eliminar</button></div>';
        const b=c.querySelectorAll('button');
        b[0].onclick=function(){editProduct(p.id)};
        b[1].onclick=function(){deleteProduct(p.id)};
        r.appendChild(c);
      });
      const h=pt.querySelector('thead tr');
      if(h&&!h.querySelector('.actions-head')){const th=document.createElement('th');th.className='actions-head';th.textContent='Acciones';h.appendChild(th);}
    }
  }
  window.render=function(){originalRender();decorate();};

  // El envío es opcional al crear una inversión (puede quedar pendiente)
  const ship=document.getElementById('iship');
  if(ship){ship.required=false;ship.removeAttribute('required');ship.value='';ship.placeholder='Pendiente / 0.00';}

  const investmentForm=document.getElementById('if');
  if(investmentForm){
    investmentForm.onsubmit=function(e){
      e.preventDefault(); e.stopPropagation();
      const c=document.getElementById('icur').value;
      const merch=Math.max(0,Number(document.getElementById('imerch').value)||0);
      const rawShip=document.getElementById('iship').value.trim();
      const shipping=rawShip===''?null:Math.max(0,Number(rawShip)||0);
      db.investments.push({id:makeId(),name:document.getElementById('iname').value.trim(),date:document.getElementById('idate').value||today(),cur:c,merch,ship:shipping,total:merch+(shipping==null?0:shipping),alloc:document.getElementById('ialloc').value,rateSnapshot:rate(c)});
      this.reset();document.getElementById('idate').value=today();save();togglePanel('investmentForm');
    };
  }

  // Registro de venta: usa el producto real seleccionado, valida stock y precio
  const sf=document.getElementById('sf');
  if(sf){
    const saleBtn=sf.querySelector('.sale-button');
    function registerSale(e){
      if(e){e.preventDefault();e.stopPropagation();}
      const p=prod(document.getElementById('sprod').value);
      const q=Math.floor(Number(document.getElementById('sq').value)||0);
      const price=Number(document.getElementById('sprice').value);
      const cur=document.getElementById('scur').value;
      if(!p){alert('Selecciona un producto antes de registrar la venta.');return false;}
      if(q<1){alert('La cantidad debe ser de al menos 1 unidad.');return false;}
      if(q>Number(p.stock||0)){alert('No hay suficiente stock. Disponible: '+p.stock+'.');return false;}
      if(!Number.isFinite(price)||price<0){alert('Introduce un precio de venta válido.');return false;}
      db.sales.push({id:makeId(),date:document.getElementById('sdate').value||today(),prodId:p.id,qty:q,price,cur,pay:document.getElementById('spay').value,rateSnapshot:rate(cur)});
      p.stock=Number(p.stock)-q;
      sf.reset();document.getElementById('sdate').value=today();
      save();
      nav('sales');
      alert('✓ Venta registrada correctamente.');
      return false;
    }
    sf.onsubmit=registerSale;
    if(saleBtn)saleBtn.onclick=registerSale;
  }

  // Búsqueda por identificador (SKU, estilo o código de barras) en Ventas
  const sbar=document.getElementById('sbar');
  if(sbar){
    sbar.oninput=function(){
      const q=this.value.trim().toLowerCase(); if(!q)return;
      const fields=p=>[p.barcode,p.sku,p.style,p.name].map(v=>String(v||'').toLowerCase());
      const p=db.products.find(x=>fields(x).some(v=>v===q))||db.products.find(x=>fields(x).some(v=>v.includes(q)));
      if(p){
        document.getElementById('sprod').value=p.id;
        if(typeof fillSale==='function')fillSale();
        else {document.getElementById('sprice').value=p.price;document.getElementById('scur').value=p.cur;}
      } else {
        document.getElementById('preview').textContent='No hay ningún producto registrado con ese identificador.';
        document.getElementById('salePreviewSide').textContent='Identificador no registrado.';
      }
    };
  }

  window.render();
  setQuick(document.querySelector('main>section:not(.hidden)')?.id||'dashboard');
})();
