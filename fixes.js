/* Control Empresarial v1.3 - UX and workflow fixes */
(function(){
  const oldRender = window.render;
  const oldNav = window.nav;

  const css = document.createElement('style');
  css.textContent = `
    .section-head{display:none!important}
    #quick.action-hidden{display:none!important}
    .row-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
    .row-action{border:1px solid var(--line);background:var(--card2);color:var(--blue);border-radius:9px;padding:7px 9px;font-size:10px;font-weight:800}
    .row-action.danger-action{color:var(--bad)}
    .sale-status{margin-top:8px;font-size:11px;font-weight:700;color:var(--muted)}
    .sale-status.ok{color:var(--good)}
    .sale-status.error{color:var(--bad)}
  `;
  document.head.appendChild(css);

  function setQuick(page){
    const q=document.getElementById('quick');
    if(!q)return;
    const actions={
      dashboard:['＋','Registrar venta',()=>nav('sales')],
      investments:['＋','Nueva inversión',()=>togglePanel('investmentForm')],
      inventory:['＋','Agregar producto',()=>togglePanel('productForm')],
      expenses:['＋','Nuevo gasto',()=>togglePanel('expenseForm')]
    };
    const a=actions[page];
    if(!a){q.classList.add('action-hidden');return}
    q.classList.remove('action-hidden');
    q.textContent=a[0];q.setAttribute('aria-label',a[1]);q.title=a[1];q.onclick=a[2];
  }

  window.nav=function(page){oldNav(page);setQuick(page)};

  function editInvestment(id){
    const i=db.investments.find(x=>x.id===id);if(!i)return;
    const name=prompt('Referencia del pedido:',i.name||'');
    if(name===null)return;
    const merch=prompt('Mercancía ('+i.cur+'):',String(i.merch??0));
    if(merch===null)return;
    const shipValue=prompt('Envío ('+i.cur+'). Déjalo vacío si todavía no lo conoces:',i.ship==null?'':String(i.ship));
    if(shipValue===null)return;
    const date=prompt('Fecha (AAAA-MM-DD):',i.date||today());
    if(date===null)return;
    i.name=name.trim()||i.name;
    i.merch=Math.max(0,+merch||0);
    i.ship=shipValue.trim()===''?null:Math.max(0,+shipValue||0);
    i.total=i.merch+(i.ship==null?0:i.ship);
    i.date=date||i.date;
    save();
  }
  window.editInvestment=editInvestment;

  function decorateInvestments(){
    const table=document.querySelector('#it table');if(!table)return;
    const rows=table.querySelectorAll('tbody tr');
    rows.forEach((row,idx)=>{
      const i=db.investments[idx];if(!i)return;
      const cell=document.createElement('td');
      cell.innerHTML='<div class="row-actions"><button class="row-action" type="button">Editar</button></div>';
      cell.querySelector('button').onclick=()=>editInvestment(i.id);
      row.appendChild(cell);
    });
    const head=table.querySelector('thead tr');
    if(head&&!head.querySelector('.actions-head')){const th=document.createElement('th');th.className='actions-head';th.textContent='Acciones';head.appendChild(th)}
    // Show clearly when shipping is still unknown.
    rows.forEach((row,idx)=>{const i=db.investments[idx];if(i&&i.ship==null){const totalCell=row.children[1];if(totalCell)totalCell.innerHTML=fmt(i.merch,i.cur)+'<br><small style="color:var(--muted)">Envío pendiente</small>'}});
  }

  function decorateProducts(){
    const table=document.querySelector('#pt table');if(!table)return;
    const q=(document.getElementById('inventorySearch')?.value||'').trim().toLowerCase();
    const low=document.getElementById('stockFilter')?.classList.contains('active');
    const ps=db.products.filter(p=>{
      const match=!q||[p.name,p.sku,p.style,p.barcode].some(v=>String(v||'').toLowerCase().includes(q));
      return match&&(!low||p.stock<=2);
    });
    const rows=table.querySelectorAll('tbody tr');
    rows.forEach((row,idx)=>{
      const p=ps[idx];if(!p)return;
      const cell=document.createElement('td');
      cell.innerHTML='<div class="row-actions"><button class="row-action" type="button">Editar</button><button class="row-action danger-action" type="button">Eliminar</button></div>';
      const buttons=cell.querySelectorAll('button');
      buttons[0].onclick=()=>editProduct(p.id);
      buttons[1].onclick=()=>deleteProduct(p.id);
      row.appendChild(cell);
    });
    const head=table.querySelector('thead tr');
    if(head&&!head.querySelector('.actions-head')){const th=document.createElement('th');th.className='actions-head';th.textContent='Acciones';head.appendChild(th)}
  }

  function editProduct(id){
    const p=db.products.find(x=>x.id===id);if(!p)return;
    const name=prompt('Nombre del producto:',p.name||'');if(name===null)return;
    const qty=prompt('Cantidad total registrada:',String(p.qty??p.stock??0));if(qty===null)return;
    const cost=prompt('Costo unitario ('+p.cur+'):',String(p.cost??0));if(cost===null)return;
    const price=prompt('Precio de venta ('+p.cur+'):',String(p.price??0));if(price===null)return;
    p.name=name.trim()||p.name;
    const oldTotal=+p.qty||0,newTotal=Math.max(0,+qty||0),sold=Math.max(0,oldTotal-(+p.stock||0));
    p.qty=newTotal;p.stock=Math.max(0,newTotal-sold);p.cost=Math.max(0,+cost||0);p.price=Math.max(0,+price||0);
    save();
  }
  window.editProduct=editProduct;

  function deleteProduct(id){
    const p=db.products.find(x=>x.id===id);if(!p)return;
    const hasSales=db.sales.some(s=>s.prodId===id);
    const msg=hasSales
      ? 'Este producto tiene ventas registradas. Eliminarlo también eliminará esas ventas del historial. ¿Continuar?'
      : '¿Eliminar este producto del inventario?';
    if(!confirm(msg))return;
    db.products=db.products.filter(x=>x.id!==id);
    if(hasSales)db.sales=db.sales.filter(s=>s.prodId!==id);
    save();
  }
  window.deleteProduct=deleteProduct;

  // Make shipping optional at creation time.
  const ship=document.getElementById('iship');
  if(ship){ship.required=false;ship.removeAttribute('required');ship.value='';ship.placeholder='Pendiente / 0.00'}

  // Replace investment creation so shipping can genuinely remain unknown.
  const investmentForm=document.getElementById('if');
  if(investmentForm){
    investmentForm.onsubmit=function(e){
      e.preventDefault();
      const c=document.getElementById('icur').value;
      const merch=Math.max(0,+document.getElementById('imerch').value||0);
      const shipInput=document.getElementById('iship').value.trim();
      const shipping=shipInput===''?null:Math.max(0,+shipInput||0);
      db.investments.push({
        id:uid(),name:document.getElementById('iname').value.trim(),date:document.getElementById('idate').value||today(),
        cur:c,merch,ship:shipping,total:merch+(shipping==null?0:shipping),alloc:document.getElementById('ialloc').value,rateSnapshot:rate(c)
      });
      this.reset();document.getElementById('idate').value=today();
      save();
      togglePanel('investmentForm');
    };
  }

  // Replace the sale submit flow with a stricter, explicit handler.
  const sf=document.getElementById('sf');
  if(sf){
    sf.onsubmit=function(e){
      e.preventDefault();
      const p=prod(document.getElementById('sprod').value);
      const q=Math.floor(+document.getElementById('sq').value||0);
      const price=+document.getElementById('sprice').value;
      const cur=document.getElementById('scur').value;
      const date=document.getElementById('sdate').value||today();
      if(!p){alert('Selecciona un producto antes de registrar la venta.');return}
      if(q<1){alert('La cantidad debe ser de al menos 1 unidad.');return}
      if(q>p.stock){alert('No hay suficiente stock. Disponible: '+p.stock+'.');return}
      if(price<0||!Number.isFinite(price)){alert('Introduce un precio de venta válido.');return}
      db.sales.push({id:uid(),date,prodId:p.id,qty:q,price,cur,pay:document.getElementById('spay').value,rateSnapshot:rate(cur)});
      p.stock-=q;
      this.reset();document.getElementById('sdate').value=today();
      save();
      nav('sales');
      alert('✓ Venta registrada correctamente.');
    };
  }

  // More forgiving product lookup: exact first, then partial identifier/name.
  const sbar=document.getElementById('sbar');
  if(sbar){
    sbar.oninput=function(){
      const q=this.value.trim().toLowerCase();
      if(!q)return;
      const exact=db.products.find(x=>[x.barcode,x.sku,x.style,x.name].some(v=>String(v||'').toLowerCase()===q));
      const p=exact||db.products.find(x=>[x.barcode,x.sku,x.style,x.name].some(v=>String(v||'').toLowerCase().includes(q)));
      if(p){document.getElementById('sprod').value=p.id;fillSale();}
      else{document.getElementById('preview').textContent='No hay ningún producto registrado con ese identificador.';document.getElementById('salePreviewSide').textContent='Identificador no registrado.';}
    };
  }

  window.decorateUI=function(){decorateInvestments();decorateProducts()};
  window.render=function(){oldRender();decorateUI()};

  // Initial pass and context-sensitive header action.
  window.render();
  setQuick(document.querySelector('main>section:not(.hidden)')?.id||'dashboard');
})();
