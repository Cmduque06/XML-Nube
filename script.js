let products=[], editId=null, xmlGenerated='';
const COLORS=['#6366f1','#0ea5e9','#22c55e','#f59e0b','#ef4444','#ec4899','#14b8a6','#8b5cf6'];

const FB='https://xml-en-la-nube-default-rtdb.firebaseio.com/';

async function fbGet(){
  const r=await fetch(FB+'/productos.json');
  httpLog('GET','/productos.json',r.status);
  return r.ok?(await r.json()):null;
}
async function fbPut(id,data){
  const r=await fetch(FB+'/productos/'+id+'.json',{method:'PUT',body:JSON.stringify(data),headers:{'Content-Type':'application/json'}});
  httpLog('PUT','/productos/'+id+'.json',r.status);
  return r.ok;
}
async function fbDelete(id){
  const r=await fetch(FB+'/productos/'+id+'.json',{method:'DELETE'});
  httpLog('DELETE','/productos/'+id+'.json',r.status);
  return r.ok;
}

async function loadProducts(){
  const data=await fbGet();
  if(data && typeof data==='object'){
    products=Object.entries(data).map(([id,v])=>({...v,id}));
  }
  renderTable(); updateKPIs();
}

// ══════════════ CRUD ══════════════
const uid=()=>'P'+Date.now().toString(36).toUpperCase().slice(-5);

async function saveProduct(){
  const name=v('f-name'),cat=v('f-cat'),price=parseFloat(v('f-price'))||0,qty=parseInt(v('f-qty'))||0,desc=v('f-desc');
  if(!name||!cat){toast('Nombre y categoría son obligatorios',true);return;}
  if(price<0){toast('El precio no puede ser negativo',true);return;}
  if(qty<0){toast('La cantidad no puede ser negativa',true);return;}
  const id=editId||uid();
  const prod={id,name,cat,price,qty,desc};
  await fbPut(id,prod);
  const idx=products.findIndex(p=>p.id===id);
  if(idx>-1) products[idx]=prod; else products.push(prod);
  toast(editId?'Actualizado (PUT)':'Creado (PUT)');
  clearForm(); renderTable(); updateKPIs();
}

function editProduct(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  editId=id;
  set('f-name',p.name);set('f-cat',p.cat);set('f-price',p.price);set('f-qty',p.qty);set('f-desc',p.desc||'');
  document.getElementById('form-title').textContent='Editar Producto';
  document.getElementById('editing-id').textContent='ID: '+id;
}

async function deleteProduct(id){
  if(!confirm('¿Eliminar?'))return;
  await fbDelete(id);
  products=products.filter(p=>p.id!==id);
  toast('Eliminado (DELETE)');
  renderTable(); updateKPIs();
}

function clearForm(){
  editId=null;
  ['f-name','f-price','f-qty','f-desc'].forEach(i=>set(i,''));
  set('f-cat','');
  document.getElementById('form-title').textContent='Nuevo Producto';
  document.getElementById('editing-id').textContent='ID: (generado automáticamente)';
}

// ══════════════ RENDER ══════════════
function renderTable(){
  const tb=document.getElementById('tbl-prod');
  if(!products.length){tb.innerHTML='<tr><td colspan="5" style="text-align:center;padding:1.1rem;color:var(--muted)">Sin productos</td></tr>';return;}
  tb.innerHTML=products.map(p=>`<tr>
    <td><strong>${p.name}</strong><br><span style="color:var(--muted);font-size:.7rem">${p.id} · ${p.desc||'—'}</span></td>
    <td><span class="badge b-blue">${p.cat}</span></td>
    <td>$${Number(p.price).toLocaleString('es-CO')}</td>
    <td><span class="badge ${p.qty>10?'b-green':p.qty>0?'b-blue':'b-red'}">${p.qty}</span></td>
    <td>
      <button class="btn btn-warn" style="padding:.25rem .55rem;font-size:.72rem" onclick="editProduct('${p.id}')">✏️</button>
      <button class="btn btn-danger" style="padding:.25rem .55rem;font-size:.72rem;margin-left:.25rem" onclick="deleteProduct('${p.id}')">🗑️</button>
    </td></tr>`).join('');
}

function updateKPIs(){
  const tot=products.length,stk=products.filter(p=>p.qty>0).length,
        val=products.reduce((a,p)=>a+p.price*p.qty,0),cats=new Set(products.map(p=>p.cat)).size;
  set2('k-total',tot);set2('k-stock',stk);set2('k-val','$'+Math.round(val/1000)+'K');set2('k-cats',cats);
}

// ══════════════ HTTP LOG ══════════════
function httpLog(method,url,status){
  const el=document.getElementById('http-log');
  const c={GET:'#22d3ee',PUT:'#fbbf24',DELETE:'#f87171',POST:'#86efac'}[method]||'#e2e8f0';
  const sc=status===0?'#6b7280':status<300?'#86efac':'#f87171';
  if(el.querySelector('em'))el.innerHTML='';
  const d=document.createElement('div');
  d.innerHTML=`<span style="color:${c};font-weight:700">${method}</span> <span style="color:#7dd3fc">firebase…${url}</span> → <span style="color:${sc}">${status||'ERR (demo local)'}</span> <span style="color:#475569">[${new Date().toLocaleTimeString('es-CO')}]</span>`;
  el.appendChild(d);el.scrollTop=el.scrollHeight;
}

// ══════════════ DTD ══════════════
const DTD={
  root:'inventario', rootAttrs:['total'],
  child:'producto', childAttr:'id',
  required:['name','categoria','precio','cantidad'],
  optional:['descripcion']
};

function validarConDTD(xmlStr){
  const errors=[],warns=[];
  let doc;
  try{
    doc=new DOMParser().parseFromString(xmlStr,'application/xml');
    if(doc.querySelector('parsererror')) throw new Error('XML mal formado');
  }catch(e){return{ok:false,errors:['❌ '+e.message],warns:[]};}
  const root=doc.documentElement;
  if(root.tagName!==DTD.root) errors.push(`❌ Raíz debe ser <${DTD.root}>, encontrado <${root.tagName}>`);
  DTD.rootAttrs.forEach(a=>{if(!root.getAttribute(a)) errors.push(`❌ Falta atributo obligatorio "${a}" en raíz (#REQUIRED)`);});
  const kids=[...root.children];
  const ids=new Set();
  kids.forEach((p,i)=>{
    const n=i+1;
    if(p.tagName!==DTD.child) errors.push(`❌ Hijo ${n}: esperado <${DTD.child}>, encontrado <${p.tagName}>`);
    const id=p.getAttribute(DTD.childAttr);
    if(!id) errors.push(`❌ Producto ${n}: falta atributo id (#REQUIRED)`);
    else if(ids.has(id)) errors.push(`❌ Producto ${n}: id="${id}" duplicado (DTD tipo ID debe ser único)`);
    else ids.add(id);
    DTD.required.forEach(el=>{if(!p.querySelector(el)) errors.push(`❌ Producto ${n} (${id||'?'}): falta elemento obligatorio <${el}>`);});
    const precio=Number(p.querySelector('precio')?.textContent);
    const cantidad=Number(p.querySelector('cantidad')?.textContent);
    if(Number.isFinite(precio)&&precio<0) errors.push(`❌ Producto ${n} (${id||'?'}): <precio> no puede ser negativo`);
    if(Number.isFinite(cantidad)&&cantidad<0) errors.push(`❌ Producto ${n} (${id||'?'}): <cantidad> no puede ser negativa`);
    [...p.children].forEach(ch=>{
      if(![...DTD.required,...DTD.optional].includes(ch.tagName))
        warns.push(`⚠️ Producto ${n}: elemento <${ch.tagName}> no declarado en DTD`);
    });
  });
  return{ok:!errors.length,errors,warns};
}

function showDTDResult(res, container){
  const ok=res.ok;
  document.getElementById(container).style.display='block';
  document.getElementById(container).innerHTML=`
    <div style="background:${ok?'#052e16':'#450a0a'};border:1px solid ${ok?'#22c55e':'#ef4444'};border-radius:8px;padding:.8rem">
      <div style="font-weight:700;font-size:.86rem;color:${ok?'#86efac':'#fca5a5'};margin-bottom:${res.errors.length||res.warns.length?'.45rem':'0'}">
        ${ok?'✅ XML válido del inventario':'❌ XML NO válido'}
      </div>
      ${res.errors.map(e=>`<div style="font-size:.77rem;color:#fca5a5;line-height:1.8">${e}</div>`).join('')}
      ${res.warns.map(w=>`<div style="font-size:.77rem;color:#fde68a;line-height:1.8">${w}</div>`).join('')}
      ${ok&&!res.warns.length?'<div style="font-size:.77rem;color:#86efac">Estructura correcta: todos los elementos y atributos cumplen el DTD.</div>':''}
    </div>`;
}

// ══════════════ XML REPORT ══════════════
function buildXML(){
  let x='<?xml version="1.0" encoding="UTF-8"?>\n';
  x+=`<inventario total="${products.length}">\n`;
  products.forEach(p=>{
    x+=`  <producto id="${p.id}">\n`;
    x+=`    <name>${esc(p.name)}</name>\n`;
    x+=`    <categoria>${esc(p.cat)}</categoria>\n`;
    x+=`    <precio>${p.price}</precio>\n`;
    x+=`    <cantidad>${p.qty}</cantidad>\n`;
    if(p.desc) x+=`    <descripcion>${esc(p.desc)}</descripcion>\n`;
    x+=`  </producto>\n`;
  });
  x+='</inventario>';
  xmlGenerated=x;

  // KPIs
  const tv=products.reduce((a,p)=>a+p.price*p.qty,0);
  const tu=products.reduce((a,p)=>a+p.qty,0);
  document.getElementById('kpis2').innerHTML=[
    ['$'+Math.round(tv/1000000*10)/10+'M','Valor total inventario'],
    [products.length,'Nodos <producto> en XML'],
    [tu,'Unidades totales'],
    [new Set(products.map(p=>p.cat)).size,'Categorías'],
  ].map(([n,l])=>`<div class="kpi"><div class="kpi-n">${n}</div><div class="kpi-l">${l}</div></div>`).join('');

  // Árbol
  document.getElementById('xml-tree-view').innerHTML=treeHtml(x);
  document.getElementById('xml-raw-view').textContent=x;

  // DTD view
  document.getElementById('xml-dtd-view').innerHTML=`
    <div class="code-block" style="font-size:.72rem"><span class="dtd-tag">&lt;!DOCTYPE</span> <span class="dtd-key">inventario</span> [
  <span class="dtd-tag">&lt;!ELEMENT</span> <span class="dtd-key">inventario</span> (producto*)<span class="dtd-tag">&gt;</span>
  <span class="dtd-tag">&lt;!ATTLIST</span> <span class="dtd-key">inventario</span> total CDATA <span class="dtd-val">#REQUIRED</span><span class="dtd-tag">&gt;</span>
  <span class="dtd-tag">&lt;!ELEMENT</span> <span class="dtd-key">producto</span> (name,categoria,precio,cantidad,descripcion?)<span class="dtd-tag">&gt;</span>
  <span class="dtd-tag">&lt;!ATTLIST</span> <span class="dtd-key">producto</span> id ID <span class="dtd-val">#REQUIRED</span><span class="dtd-tag">&gt;</span>
  <span class="dtd-tag">&lt;!ELEMENT</span> <span class="dtd-key">name</span> (#PCDATA)<span class="dtd-tag">&gt;</span>  <span class="dtd-tag">&lt;!ELEMENT</span> <span class="dtd-key">categoria</span> (#PCDATA)<span class="dtd-tag">&gt;</span>
  <span class="dtd-tag">&lt;!ELEMENT</span> <span class="dtd-key">precio</span> (#PCDATA)<span class="dtd-tag">&gt;</span>  <span class="dtd-tag">&lt;!ELEMENT</span> <span class="dtd-key">cantidad</span> (#PCDATA)<span class="dtd-tag">&gt;</span>
  <span class="dtd-tag">&lt;!ELEMENT</span> <span class="dtd-key">descripcion</span> (#PCDATA)<span class="dtd-tag">&gt;</span>
]&gt;</div>`;

  // Barras
  const byQ={},byV={};
  products.forEach(p=>{byQ[p.cat]=(byQ[p.cat]||0)+p.qty;byV[p.cat]=(byV[p.cat]||0)+p.price*p.qty;});
  bars('chart-qty',byQ,tu,'unidades');
  bars('chart-val',byV,tv,'$');

  // Tabla
  const keys=['id','name','cat','price','qty','desc'];
  const labs=['ID','Nombre','Categoría','Precio','Cantidad','Descripción'];
  document.getElementById('xml-tbl-head').innerHTML=labs.map(l=>`<th style="padding:.45rem .65rem;border-bottom:1px solid var(--border)">${l}</th>`).join('');
  document.getElementById('xml-tbl-body').innerHTML=products.map((p,i)=>`
    <tr style="${i%2?'':'background:#ffffff03'}">
      ${keys.map(k=>`<td style="padding:.45rem .65rem;border-bottom:1px solid #1a2744">${p[k]||'—'}</td>`).join('')}
    </tr>`).join('');

  // Validar DTD automáticamente
  const res=validarConDTD(x);
  showDTDResult(res,'dtd-result');
}

function revalidate(){const res=validarConDTD(xmlGenerated||'');showDTDResult(res,'dtd-result');}

function bars(id,data,tot,unit){
  const sorted=Object.entries(data).sort((a,b)=>b[1]-a[1]);
  document.getElementById(id).innerHTML=sorted.map(([cat,val],i)=>{
    const pct=Math.round(val/tot*100);
    const fmt=unit==='$'?'$'+Number(val).toLocaleString('es-CO'):Number(val).toLocaleString('es-CO')+' unidades';
    return `<div class="cat-row"><div class="cat-label"><span>${cat}</span><span>${fmt} — ${pct}%</span></div>
    <div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:${COLORS[i%COLORS.length]}"></div></div></div>`;
  }).join('');
}

// ══════════════ ÁRBOL XML ══════════════
function treeHtml(xml){
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  return nodeHtml(doc.documentElement,0);
}
function nodeHtml(node,d){
  const ind='&nbsp;'.repeat(d*3);
  if(node.nodeType===3){const v=node.textContent.trim();return v?`<span class="xt-val">${escH(v)}</span>`:'';}
  if(node.nodeType!==1)return '';
  const tag=node.tagName;
  const attrs=[...node.attributes].map(a=>`<span class="xt-attr"> ${a.name}="<span class="xt-val">${escH(a.value)}</span>"</span>`).join('');
  const kids=[...node.childNodes].filter(n=>n.nodeType===1||(n.nodeType===3&&n.textContent.trim()));
  if(!kids.length) return `<div>${ind}<span class="xt-tag">&lt;${tag}${attrs}&gt;</span><span class="xt-val">${escH(node.textContent.trim())}</span><span class="xt-tag">&lt;/${tag}&gt;</span></div>`;
  const nid='n'+Math.random().toString(36).slice(2);
  return `<div id="${nid}"><div onclick="tgl('${nid}')" style="cursor:pointer">${ind}<span class="xt-toggle">▼</span><span class="xt-tag">&lt;${tag}${attrs}&gt;</span></div>
    <div class="xt-ch">${kids.map(c=>nodeHtml(c,d+1)).join('')}<div>${ind}<span class="xt-tag">&lt;/${tag}&gt;</span></div></div></div>`;
}
function tgl(id){const el=document.getElementById(id);const ch=el.querySelector('.xt-ch');const tg=el.querySelector('.xt-toggle');const h=ch.style.display==='none';ch.style.display=h?'':'none';tg.textContent=h?'▼':'▶';}

function xmlTab(t){
  ['tree','raw','dtd'].forEach(x=>{
    document.getElementById('xml-'+x+'-view').style.display=t===x?'':'none';
    document.getElementById('tb-'+x).className='tab-btn'+(t===x?' active':'');
  });
}

const CASOS_VALIDACION={
  valido:`<inventario total="2">
  <producto id="P001">
    <name>Laptop Dell</name>
    <categoria>Electronica</categoria>
    <precio>4500000</precio>
    <cantidad>12</cantidad>
    <descripcion>Equipo portatil</descripcion>
  </producto>
  <producto id="P002">
    <name>Camiseta</name>
    <categoria>Ropa</categoria>
    <precio>85000</precio>
    <cantidad>45</cantidad>
  </producto>
</inventario>`,
  malformado:`<inventario total="1">
  <producto id="P001">
    <name>Laptop Dell</name>
    <categoria>Electronica</categoria>
    <precio>4500000</precio>
    <cantidad>12</cantidad>
  </producto>`,
  raiz:`<almacen total="1">
  <producto id="P001">
    <name>Laptop Dell</name>
    <categoria>Electronica</categoria>
    <precio>4500000</precio>
    <cantidad>12</cantidad>
  </producto>
</almacen>`,
  atributosRaiz:`<inventario>
  <producto id="P001">
    <name>Laptop Dell</name>
    <categoria>Electronica</categoria>
    <precio>4500000</precio>
    <cantidad>12</cantidad>
  </producto>
</inventario>`,
  hijoIncorrecto:`<inventario total="1">
  <item id="P001">
    <name>Laptop Dell</name>
    <categoria>Electronica</categoria>
    <precio>4500000</precio>
    <cantidad>12</cantidad>
  </item>
</inventario>`,
  sinId:`<inventario total="1">
  <producto>
    <name>Laptop Dell</name>
    <categoria>Electronica</categoria>
    <precio>4500000</precio>
    <cantidad>12</cantidad>
  </producto>
</inventario>`,
  idDuplicado:`<inventario total="2">
  <producto id="P001">
    <name>Laptop Dell</name>
    <categoria>Electronica</categoria>
    <precio>4500000</precio>
    <cantidad>12</cantidad>
  </producto>
  <producto id="P001">
    <name>Mouse</name>
    <categoria>Electronica</categoria>
    <precio>90000</precio>
    <cantidad>30</cantidad>
  </producto>
</inventario>`,
  faltanElementos:`<inventario total="1">
  <producto id="P001">
    <name>Laptop Dell</name>
    <precio>4500000</precio>
  </producto>
</inventario>`,
  valoresNegativos:`<inventario total="1">
  <producto id="P001">
    <name>Laptop Dell</name>
    <categoria>Electronica</categoria>
    <precio>-4500000</precio>
    <cantidad>-12</cantidad>
  </producto>
</inventario>`
};

function cargarCasoValidacion(tipo){
  if(document.getElementById('dtd-xml-ok')) set('dtd-xml-ok',CASOS_VALIDACION.valido);
  set('dtd-xml',CASOS_VALIDACION[tipo]||CASOS_VALIDACION.valido);
  validarComparacion();
}

function validarComparacion(){
  const okXml=document.getElementById('dtd-xml-ok');
  if(okXml){
    showDTDResult(validarConDTD(okXml.value),'manual-result-ok');
  }
  validarManual();
}

function validarManual(){
  const res=validarConDTD(document.getElementById('dtd-xml').value);
  showDTDResult(res,'manual-result');
}

// ══════════════ NAV ══════════════
function showPage(id,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}

// ══════════════ UTILS ══════════════
const v=id=>document.getElementById(id).value.trim();
const set=(id,val)=>document.getElementById(id).value=val;
const set2=(id,val)=>document.getElementById(id).textContent=val;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escH=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function toast(msg,err=false){const t=document.getElementById('toast');t.textContent=msg;t.className='toast show'+(err?' err':'');setTimeout(()=>t.className='toast',2600);}

// ══════════════ INIT ══════════════
loadProducts();
cargarCasoValidacion('malformado');
