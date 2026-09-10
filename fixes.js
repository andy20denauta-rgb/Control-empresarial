/* Control Empresarial v1.4 - acciones y ventas robustas */
(function(){
  'use strict';

  const originalRender = window.render;
  const originalNav = window.nav;
  const makeId = window.uid || function(){ return Date.now().toString(36)+Math.random().toString(36).slice(2); };

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

  function setQuick(page){
    const q=document.getElementById('quick'); if(!q)return;
    const actions={
      dashboard:['＋','Registrar venta',()=>originalNav('sales')],
      investments:['＋','Nueva inversión',()=>togglePanel('investmentForm')],
      inventory:['＋','Agregar producto',()=>togglePanel('productForm')],
      expenses:['＋','Nuevo gasto',()=>togglePanel('expenseForm')]
    };
    const a=actions[page];
    if(!a){q.classList.add('action-hidden');q.onclick=null;return;}
    q.classList.remove('action-hidden');q.textContent=a[0];q.setAttribute('aria-label',a[1]);q.title=a[1];q.onclick=a[2];
  }

  window.nav=function(page){originalNav(page);setQuick(page)};

  function editInvestment(id){
    const i=db.investments.find(x=>x.id===id); if(!i)return;
    const name=prompt('Referencia del pedido:',i.name||''); if(name===null)return;
    const merch=prompt('Mercancía ('+i.cur+'):',String(i.merch??0)); if(merch===null)return;
    const ship=prompt('Envío ('+i.cur+'). Déjalo vacío si aún no lo conoces:',i.ship==null?'':String(i.ship)); if(ship===null)return;
    const date=prompt('Fecha (AAAA-MM-DD):',i.date||today()); if(date===null)return;
    i.name=name.trim()||i.name;
    i.merch=Math.max(0,Number(merch)||0);
    i.ship=ship.trim()===''?null:Math.max(0,Number(ship)||0);
    i.total=i.merch+(i.ship==null?0:i.ship);
    i.date=date||i.date;
    save();
  }
  window.editInvestment=editInvestment;

  function editProduct(id){
    const p=db.products.find(x=>x.id===id); if(!p)return;
    const name=prompt('Nombre del producto:',p.name||''); if(name===null)return;
    const qty=prompt('Cantidad total registrada:',String(p.qty??p.stock??0)); if(qty===null)return;
    const cost=prompt('Costo unitario ('+p.cur+'):',String(p.cost??0)); if(cost===null)return;
    const price=prompt('Precio de venta ('+p.cur+'):',String(p.price??0)); if(price===null)return;
    const oldTotal=Number(p.qty)||0, oldStock=Number(p.stock)||0;
    const sold=Math.max(0,oldTotal-oldStock), newTotal=Math.max(sold,Number(qty)||0);
    p.name=name.trim()||p.name; p.qty=newTotal; p.stock=Math.max(0,newTotal-sold);
    p.cost=Math.max(0,Number(cost)||0); p.price=Math.max(0,Number(price)||0);
    save();
  }
  window.editProduct=editProduct;

  function deleteProduct(id){
    const p=db.products.find(x=>x.id===id); if(!p)return;
    const hasSales=db.sales.some(s=>s.prodId===id);
    const msg=hasSales?'Este producto tiene ventas registradas. Si lo eliminas, también se eliminarán esas ventas del historial. ¿Continuar?':'¿Eliminar este producto del inventario?';
    if(!confirm(msg))return;
    db.products=db.products.filter(x=>x.id!==id);
    if(hasSales)db.sales=db.sales.filter(s=>s.prodId!==id);
    save();
  }
  window.deleteProduct=deleteProduct;

  function decorateInvestments(){
    const table=document.querySelector('#it table'); if(!table)return;
    const rows=[...table.querySelectorAll('tbody tr')];
    const list=db.investments.slice();
    rows.forEach((row,idx)=>{
      const i=list[idx]; if(!i)return;
      const cell=document.createElement('td');
      cell.innerHTML='<div class="row-actions"><button type="button" class="row-action" data-action="edit-investment" data-id="'+i.id+'">Editar</button></div>';
      row.appendChild(cell);
      if(i.ship==null && row.children[1]) row.children[1].innerHTML=fmt(i.merch,i.cur)+'<br><small style="color:var(--muted)">Envío pendiente</small>';
    });
    const head=table.querySelector('thead tr');
    if(head&&!head.querySelector('.actions-head')){const th=document.createElement('th');th.className='actions-head';th.textContent='Acciones';head.appendChild(th)}
  }

  function decorateProducts(){
    const table=document.querySelector('#pt table'); if(!table)return;
    const q=(document.getElementById('inventorySearch')?.value||'').trim().toLowerCase();
    const low=document.getElementById('stockFilter')?.classList.contains('active');
    const list=db.products.filter(p=>{
      const match=!q||[p.name,p.sku,p.style,p.barcode].some(v=>String(v||'').toLowerCase().includes(q));
      return match&&(!low||Number(p.stock)<=2);
    });
    const rows=[...table.querySelectorAll('tbody tr')];
    rows.forEach((row,idx)=>{
      const p=list[idx]; if(!p)return;
      const cell=document.createElement('td');
      cell.innerHTML='<div class="row-actions"><button type="button" class="row-action" data-action="edit-product" data-id="'+p.id+'">Editar</button><button type="button" class="row-action danger-action" data-action="delete-product" data-id="'+p.id+'">Eliminar</button></div>';
      row.appendChild(cell);
    });
    const head=table.querySelector('thead tr');
    if(head&&!head.querySelector('.actions-head')){const th=document.createElement('th');th.className='actions-head';th.textContent='Acciones';head.appendChild(th)}
  }

  // Event delegation: survives every render and Android WebView refresh.
  document.addEventListener('click',function(e){
    const b=e.target.closest?.('[data-action]'); if(!b)return;
    e.preventDefault(); e.stopPropagation();
    const id=b.getAttribute('data-id'), action=b.getAttribute('data-action');
    if(action==='edit-investment')editInvestment(id);
    else if(action==='edit-product')editProduct(id);
    else if(action==='delete-product')deleteProduct(id);
  },true);

  // Shipping is optional when creating an investment.
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

  // Reliable sale registration. Uses the actual product selected in the form.
  const sf=document.getElementById('sf');
  if(sf){
    sf.onsubmit=function(e){
      e.preventDefault(); e.stopPropagation();
      const select=document.getElementById('sprod');
      const p=prod(select?.value);
      const q=Math.floor(Number(document.getElementById('sq').value)||0);
      const price=Number(document.getElementById('sprice').value);
      const cur=document.getElementById('scur').value;
      if(!p){alert('Selecciona un producto antes de registrar la venta.');return false;}
      if(q<1){alert('La cantidad debe ser de al menos 1 unidad.');return false;}
      if(q>Number(p.stock||0)){alert('No hay suficiente stock. Disponible: '+p.stock+'.');return false;}
      if(!Number.isFinite(price)||price<0){alert('Introduce un precio de venta válido.');return false;}
      db.sales.push({id:makeId(),date:document.getElementById('sdate').value||today(),prodId:p.id,qty:q,price,cur,pay:document.getElementById('spay').value,rateSnapshot:rate(cur)});
      p.stock=Number(p.stock)-q;
      this.reset();document.getElementById('sdate').value=today();
      save();
      setTimeout(function(){originalNav('sales');setQuick('sales');},0);
      alert('✓ Venta registrada correctamente.');
      return false;
    };
  }

  // Identifier lookup + immediate product selection.
  const sbar=document.getElementById('sbar');
  if(sbar){
    sbar.oninput=function(){
      const q=this.value.trim().toLowerCase(); if(!q)return;
      const fields=p=>[p.barcode,p.sku,p.style,p.name].map(v=>String(v||'').toLowerCase());
      const p=db.products.find(x=>fields(x).some(v=>v===q))||db.products.find(x=>fields(x).some(v=>v.includes(q)));
      if(p){document.getElementById('sprod').value=p.id; if(typeof fillSale==='function')fillSale(); else {document.getElementById('sprice').value=p.price;document.getElementById('scur').value=p.cur;} }
      else {document.getElementById('preview').textContent='No hay ningún producto registrado con ese identificador.';document.getElementById('salePreviewSide').textContent='Identificador no registrado.';}
    };
  }

  window.render=function(){originalRender();decorateInvestments();decorateProducts();};
  window.render();
  setQuick(document.querySelector('main>section:not(.hidden)')?.id||'dashboard');
})();
