/* ====================================================
   CONFIGURACIÃ“N FIREBASE â€” Reemplaza estos valores
   con los de tu proyecto en Firebase Console
   ==================================================== */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBi4JWv1O7pK2AI5QXpWNaVHJ6vR3YIN8E",
  authDomain:        "ce-antioquenidad.firebaseapp.com",
  projectId:         "ce-antioquenidad",
  storageBucket:     "ce-antioquenidad.firebasestorage.app",
  messagingSenderId: "772504238512",
  appId:             "1:772504238512:web:8434dae93ba5f40cb83e75",
  measurementId:     "G-5DK23T4FTD"
};

let db, currentUser, currentProfile;

const DEFAULT_USERS = [
  { id: 'admin', nombre: 'Administrador', email: 'admin@cesannicolas.com', pass: 'Admin123', rol: 'admin', tipoVenta: '', tel: '', estado: 'activo' },
  { id: 'banco', nombre: 'Banco Principal', email: 'banco@cesannicolas.com', pass: 'Banco123', rol: 'banco', tipoVenta: '', tel: '', estado: 'activo' },
  { id: 'venta', nombre: 'Vendedor Demo', email: 'venta@cesannicolas.com', pass: 'Venta123', rol: 'venta', tipoVenta: 'perros', tel: '', estado: 'activo' }
];

function showLogin() {
  document.getElementById('screen-login').style.display = '';
  document.getElementById('screen-app').style.display   = 'none';
}

function initFirebase(cfg) {
  firebase.initializeApp(cfg);
  db = firebase.firestore();
  showLogin();
  ensureDemoUsers().then(restoreSession).catch(() => restoreSession());
}

/* ====================================================
   ARRANQUE
   ==================================================== */
window.addEventListener('load', () => {
  initFirebase(FIREBASE_CONFIG);
});

/* ====================================================
   LOGIN CON FIRESTORE
   ==================================================== */
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showMsg('login-error','Completa todos los campos.', true); return; }
  document.getElementById('btn-login').disabled = true;
  document.getElementById('btn-login').textContent = 'Ingresando...';
  try {
    const userDoc = await findUserByEmail(email);
    if (!userDoc) throw new Error('Usuario no encontrado');
    const profile = userDoc.data();
    if (profile.estado === 'inactivo') throw new Error('Usuario inactivo');
    if ((profile.pass || profile.password || '') !== pass) throw new Error('Credenciales incorrectas');

    currentUser = { uid: userDoc.id, email: profile.email };
    currentProfile = { ...profile, id: userDoc.id };
    sessionStorage.setItem('antioUserId', userDoc.id);
    mostrarApp();
  } catch(e) {
    showMsg('login-error', 'Credenciales incorrectas. Verifica tu usuario y contraseÃ±a.', true);
  } finally {
    document.getElementById('btn-login').disabled = false;
    document.getElementById('btn-login').textContent = 'Ingresar al Sistema';
  }
}

async function doLogout() {
  sessionStorage.removeItem('antioUserId');
  currentUser = null;
  currentProfile = null;
  showLogin();
}

async function restoreSession() {
  const uid = sessionStorage.getItem('antioUserId');
  if (!uid) return;
  try {
    const snap = await db.collection('usuarios').doc(uid).get();
    if (!snap.exists) return doLogout();
    currentProfile = { ...snap.data(), id: snap.id };
    currentUser = { uid: snap.id, email: currentProfile.email };
    mostrarApp();
  } catch(e) {
    doLogout();
  }
}

async function ensureDemoUsers() {
  const snap = await db.collection('usuarios').limit(1).get();
  if (!snap.empty) return;
  const batch = db.batch();
  DEFAULT_USERS.forEach(u => {
    const ref = db.collection('usuarios').doc(u.id);
    batch.set(ref, {
      ...u,
      emailLower: u.email.toLowerCase(),
      creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      creadoPor: 'sistema'
    });
  });
  await batch.commit();
}

async function findUserByEmail(email) {
  const emailLower = email.toLowerCase();
  let snap = await db.collection('usuarios').where('emailLower','==', emailLower).limit(1).get();
  if (!snap.empty) return snap.docs[0];
  snap = await db.collection('usuarios').where('email','==', emailLower).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

/* ====================================================
   APP PRINCIPAL
   ==================================================== */
function mostrarApp() {
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('screen-app').style.display   = '';

  // Topbar
  document.getElementById('tb-nombre').textContent = currentProfile.nombre || currentUser.email;
  const roleEl = document.getElementById('tb-role');
  roleEl.textContent = currentProfile.rol === 'admin' ? 'Admin' :
                       currentProfile.rol === 'banco' ? 'Banco' : 'Vendedor';
  roleEl.className = 'role-badge badge-' + currentProfile.rol;

  renderSidebar();
  // Navegar a pÃ¡gina inicial
  if (currentProfile.rol === 'admin')       navTo('dashboard');
  else if (currentProfile.rol === 'banco')  navTo('banco');
  else                                       navTo('venta');
}

function renderSidebar() {
  const sb = document.getElementById('sidebar');
  sb.innerHTML = '';
  const rol = currentProfile.rol;

  const addSection = t => sb.innerHTML += `<div class="sidebar-section">${t}</div>`;
  const addLink    = (icon, label, page) =>
    sb.innerHTML += `<a href="#" onclick="navTo('${page}'); return false;">${icon} ${label}</a>`;

  if (rol === 'admin') {
    addSection('AdministraciÃ³n');
    addLink('ðŸ ','Dashboard','dashboard');
    addLink('ðŸ‘¥','Usuarios','usuarios');
  }
  if (rol === 'banco') {
    addSection('Cajero');
    addLink('ðŸ¦','Registrar Ingreso','banco');
  }
  if (rol === 'venta') {
    addSection('Ventas');
    addLink('ðŸ›’','Mis Ã“rdenes','venta');
  }
  addSection('Mi Cuenta');
  addLink('ðŸ‘¤','Perfil','perfil');
}

function navTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('onclick')?.includes(`'${page}'`));
  });
  const el = document.getElementById('pg-' + page);
  if (el) el.classList.add('active');

  // Cargar datos segÃºn pÃ¡gina
  if (page === 'dashboard') loadDashboard();
  if (page === 'usuarios')  loadUsuarios();
  if (page === 'banco')     loadBanco();
  if (page === 'venta')     loadVenta();
  if (page === 'perfil')    loadPerfil();
}

/* ====================================================
   UTILIDADES UI
   ==================================================== */
function showMsg(id, txt, isError=false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = txt;
  el.style.display = 'block';
  el.className = isError ? 'error-msg' : 'success-msg';
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

function rolLabel(r) {
  return r === 'admin' ? 'Administrador' : r === 'banco' ? 'Banco' : 'Vendedor';
}

function tipoLabel(t) {
  const m = { perros:'ðŸŒ­ Perros', gaseosa:'ðŸ¥¤ Gaseosas', dulces:'ðŸ¬ Dulces', tintos:'â˜• Tintos', general:'ðŸ“¦ General' };
  return m[t] || t || 'â€”';
}

function fmtTS(ts) {
  if (!ts) return 'â€”';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-CO', {dateStyle:'short', timeStyle:'short'});
}

function makeUserId(email) {
  return email.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'usuario_' + Date.now();
}

/* ====================================================
   DASHBOARD
   ==================================================== */
async function loadDashboard() {
  try {
    const [usSnap, ordSnap] = await Promise.all([
      db.collection('usuarios').get(),
      db.collection('ordenes').orderBy('creadoEn','desc').limit(20).get()
    ]);

    document.getElementById('st-usuarios').textContent = usSnap.size;
    let ingresos = 0;
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    let ordenesHoy = 0;
    const txHTML = [];

    ordSnap.forEach(d => {
      const o = d.data();
      const fecha = o.creadoEn?.toDate ? o.creadoEn.toDate() : null;
      if (fecha && fecha >= hoy) { ordenesHoy++; ingresos += o.monto || 0; }
      txHTML.push(`
        <div class="tx-item">
          <div class="tx-icon">ðŸ’°</div>
          <div class="tx-info">
            <div class="tx-title">${o.productoLabel || o.producto || 'â€”'} Ã— ${o.unidades || 1}</div>
            <div class="tx-sub">â†’ ${o.vendedorNombre || 'â€”'} Â· ${fmtTS(o.creadoEn)}</div>
          </div>
          <div class="tx-amount">$${(o.monto||0).toLocaleString('es-CO')}</div>
        </div>`);
    });

    document.getElementById('st-ordenes').textContent = ordenesHoy;
    document.getElementById('st-ingresos').textContent = '$' + ingresos.toLocaleString('es-CO');
    document.getElementById('dash-txs').innerHTML = txHTML.length ? txHTML.join('') : '<p style="color:var(--gris)">Sin transacciones.</p>';
  } catch(e) {
    document.getElementById('dash-txs').innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}

/* ====================================================
   GESTIÃ“N USUARIOS (ADMIN)
   ==================================================== */
function toggleTipoVenta() {
  const rol = document.getElementById('u-rol').value;
  document.getElementById('fg-tipo-venta').style.display = rol === 'venta' ? '' : 'none';
}
function toggleEditTipoVenta() {
  const rol = document.getElementById('edit-rol').value;
  document.getElementById('edit-fg-tipo').style.display = rol === 'venta' ? '' : 'none';
}

async function crearUsuario() {
  const nombre    = document.getElementById('u-nombre').value.trim();
  const email     = document.getElementById('u-email').value.trim();
  const pass      = document.getElementById('u-pass').value;
  const rol       = document.getElementById('u-rol').value;
  const tipoVenta = document.getElementById('u-tipo-venta').value;
  const tel       = document.getElementById('u-tel').value.trim();

  if (!nombre || !email || !pass || !rol) { showMsg('u-err','Completa todos los campos obligatorios.', true); return; }
  if (pass.length < 6) { showMsg('u-err','La contraseÃ±a debe tener al menos 6 caracteres.', true); return; }

  try {
    const existing = await findUserByEmail(email);
    if (existing) { showMsg('u-err','El correo ya estÃ¡ registrado.', true); return; }

    const uid = makeUserId(email);
    await db.collection('usuarios').doc(uid).set({
      nombre, email: email.toLowerCase(), emailLower: email.toLowerCase(), pass, rol,
      tipoVenta: rol === 'venta' ? tipoVenta : '',
      tel, estado: 'activo',
      creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      creadoPor: currentUser.uid
    });

    showMsg('u-msg', `âœ… Usuario "${nombre}" creado correctamente.`);
    ['u-nombre','u-email','u-pass','u-tel'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('u-rol').value = '';
    document.getElementById('fg-tipo-venta').style.display = 'none';
    loadUsuarios();
  } catch(e) {
    showMsg('u-err', e.message, true);
  }
}

async function loadUsuarios() {
  const cont = document.getElementById('tabla-usuarios');
  cont.innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('usuarios').orderBy('creadoEn','desc').get();
    if (snap.empty) { cont.innerHTML = '<p style="color:var(--gris)">Sin usuarios registrados.</p>'; return; }
    let rows = '';
    snap.forEach(d => {
      const u = d.data();
      const badgeRol = u.rol === 'admin' ? 'badge-admin' : u.rol === 'banco' ? 'badge-banco' : 'badge-venta';
      rows += `<tr>
        <td>${u.nombre || 'â€”'}</td>
        <td style="font-size:0.8rem;color:var(--gris)">${u.email}</td>
        <td><span class="role-badge ${badgeRol}">${rolLabel(u.rol)}</span></td>
        <td>${u.rol==='venta' ? tipoLabel(u.tipoVenta) : 'â€”'}</td>
        <td><span class="tag tag-${u.estado||'activo'}">${u.estado||'activo'}</span></td>
        <td>
          <button class="btn btn-oro" style="padding:4px 10px;font-size:0.75rem;"
            onclick="abrirEditar('${d.id}','${u.nombre}','${u.rol}','${u.tipoVenta||''}','${u.tel||''}','${u.estado||'activo'}')">
            Editar
          </button>
        </td>
      </tr>`;
    });
    cont.innerHTML = `<table>
      <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Tipo Venta</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  } catch(e) {
    cont.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}

function abrirEditar(uid, nombre, rol, tipoVenta, tel, estado) {
  document.getElementById('edit-uid').value        = uid;
  document.getElementById('edit-nombre').value     = nombre;
  document.getElementById('edit-rol').value        = rol;
  document.getElementById('edit-tipo-venta').value = tipoVenta;
  document.getElementById('edit-tel').value        = tel;
  document.getElementById('edit-estado').value     = estado;
  document.getElementById('edit-fg-tipo').style.display = rol === 'venta' ? '' : 'none';
  document.getElementById('modal-editar').classList.add('open');
}

function cerrarModal() {
  document.getElementById('modal-editar').classList.remove('open');
}

async function guardarEdicion() {
  const uid       = document.getElementById('edit-uid').value;
  const nombre    = document.getElementById('edit-nombre').value.trim();
  const rol       = document.getElementById('edit-rol').value;
  const tipoVenta = document.getElementById('edit-tipo-venta').value;
  const tel       = document.getElementById('edit-tel').value.trim();
  const estado    = document.getElementById('edit-estado').value;
  try {
    await db.collection('usuarios').doc(uid).update({
      nombre, rol, tipoVenta: rol==='venta'?tipoVenta:'', tel, estado
    });
    showMsg('edit-msg', 'âœ… Cambios guardados.');
    loadUsuarios();
    setTimeout(cerrarModal, 1500);
  } catch(e) {
    showMsg('edit-err', e.message, true);
  }
}

/* ====================================================
   BANCO / CAJERO
   ==================================================== */
async function loadBanco() {
  // Cargar vendedores en select
  try {
    const snap = await db.collection('usuarios').where('rol','==','venta').where('estado','==','activo').get();
    const sel = document.getElementById('b-vendedor');
    sel.innerHTML = '<option value="">â€” Seleccionar vendedor â€”</option>';
    snap.forEach(d => {
      const u = d.data();
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${u.nombre} (${tipoLabel(u.tipoVenta)})`;
      opt.dataset.tipo    = u.tipoVenta || '';
      opt.dataset.nombre  = u.nombre;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      document.getElementById('b-producto').value = opt.dataset.tipo ? tipoLabel(opt.dataset.tipo) : '';
    });
  } catch(e) {}

  loadBancoHistorial();
}

async function registrarOrden() {
  const sel      = document.getElementById('b-vendedor');
  const opt      = sel.options[sel.selectedIndex];
  const vendId   = sel.value;
  const vendNom  = opt?.dataset?.nombre || '';
  const monto    = parseFloat(document.getElementById('b-monto').value) || 0;
  const unidades = parseInt(document.getElementById('b-unidades').value) || 1;
  const obs      = document.getElementById('b-obs').value.trim();
  const tipo     = opt?.dataset?.tipo || '';

  if (!vendId || !monto || !unidades) { showMsg('b-err','Completa todos los campos.', true); return; }

  try {
    await db.collection('ordenes').add({
      vendedorId:     vendId,
      vendedorNombre: vendNom,
      producto:       tipo,
      productoLabel:  tipoLabel(tipo),
      monto, unidades, obs,
      estado:         'pendiente',
      cajeroId:       currentUser.uid,
      cajeroNombre:   currentProfile.nombre,
      creadoEn:       firebase.firestore.FieldValue.serverTimestamp()
    });
    showMsg('b-msg', 'âœ… Orden enviada correctamente al vendedor.');
    ['b-monto','b-unidades','b-obs'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('b-producto').value = '';
    document.getElementById('b-vendedor').value = '';
    loadBancoHistorial();
  } catch(e) {
    showMsg('b-err', e.message, true);
  }
}

async function loadBancoHistorial() {
  const cont = document.getElementById('banco-historial');
  cont.innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('ordenes')
      .where('cajeroId','==', currentUser.uid)
      .orderBy('creadoEn','desc').limit(30).get();
    if (snap.empty) { cont.innerHTML = '<p style="color:var(--gris)">Sin Ã³rdenes enviadas hoy.</p>'; return; }
    let rows = '';
    snap.forEach(d => {
      const o = d.data();
      rows += `<tr>
        <td>${o.productoLabel || o.producto || 'â€”'}</td>
        <td>${o.vendedorNombre || 'â€”'}</td>
        <td>${o.unidades}</td>
        <td>$${(o.monto||0).toLocaleString('es-CO')}</td>
        <td><span class="tag tag-${o.estado}">${o.estado}</span></td>
        <td style="font-size:0.75rem;color:var(--gris)">${fmtTS(o.creadoEn)}</td>
      </tr>`;
    });
    cont.innerHTML = `<table>
      <thead><tr><th>Producto</th><th>Vendedor</th><th>Unidades</th><th>Monto</th><th>Estado</th><th>Hora</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  } catch(e) {
    cont.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}

/* ====================================================
   VENDEDOR
   ==================================================== */
async function loadVenta() {
  const tipo = currentProfile.tipoVenta || '';
  const titulo = document.getElementById('venta-titulo');
  const labels = { perros:'ðŸŒ­ Perros Calientes', gaseosa:'ðŸ¥¤ Gaseosas', dulces:'ðŸ¬ Dulces', tintos:'â˜• Tintos', general:'ðŸ“¦ General' };
  titulo.textContent = (labels[tipo] || 'ðŸ›’ Mis Ã“rdenes') + ' â€” Ã“rdenes Recibidas';

  const cont = document.getElementById('venta-ordenes');
  cont.innerHTML = '<div class="spinner"></div>';
  try {
    const snap = await db.collection('ordenes')
      .where('vendedorId','==', currentUser.uid)
      .orderBy('creadoEn','desc').limit(50).get();

    if (snap.empty) { cont.innerHTML = '<p style="color:var(--gris)">Sin Ã³rdenes recibidas.</p>'; return; }
    let html = '';
    snap.forEach(d => {
      const o = d.data();
      const isPend = o.estado === 'pendiente';
      html += `<div class="orden-card">
        <div class="ord-header">
          <div>
            <div class="ord-tipo">Orden de Despacho</div>
            <div class="ord-prod">${o.productoLabel || tipoLabel(o.producto)}</div>
          </div>
          <div style="text-align:right;">
            <div class="ord-cant">${o.unidades} <span>unidades</span></div>
            <div style="color:var(--verde);font-size:0.85rem;font-weight:bold;">$${(o.monto||0).toLocaleString('es-CO')}</div>
          </div>
        </div>
        ${o.obs ? `<div style="font-size:0.8rem;color:var(--gris);margin-bottom:0.5rem;">ðŸ“ ${o.obs}</div>` : ''}
        <div class="ord-meta">
          <span>ðŸ¦ ${o.cajeroNombre || 'â€”'}</span>
          <span>ðŸ• ${fmtTS(o.creadoEn)}</span>
          <span class="tag tag-${o.estado}">${o.estado}</span>
        </div>
        ${isPend ? `<button class="btn btn-verde" style="margin-top:0.8rem;padding:6px 16px;font-size:0.82rem;"
          onclick="marcarEntregado('${d.id}', this)">âœ… Marcar como Entregado</button>` : ''}
      </div>`;
    });
    cont.innerHTML = html;
  } catch(e) {
    cont.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
  }
}

async function marcarEntregado(ordId, btn) {
  btn.disabled = true;
  btn.textContent = 'Procesando...';
  try {
    await db.collection('ordenes').doc(ordId).update({ estado: 'entregado' });
    loadVenta();
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'âœ… Marcar como Entregado';
    alert('Error: ' + e.message);
  }
}

/* ====================================================
   PERFIL
   ==================================================== */
function loadPerfil() {
  document.getElementById('pf-nombre').textContent = currentProfile.nombre || 'â€”';
  document.getElementById('pf-email').textContent  = currentUser.email;
  document.getElementById('pf-rol').textContent    = rolLabel(currentProfile.rol);
  document.getElementById('pf-tipo').textContent   = currentProfile.rol === 'venta' ? tipoLabel(currentProfile.tipoVenta) : 'â€”';
}

async function cambiarPass() {
  const np = document.getElementById('new-pass').value;
  if (!np || np.length < 6) { showMsg('pf-err','MÃ­nimo 6 caracteres.', true); return; }
  try {
    await db.collection('usuarios').doc(currentUser.uid).update({ pass: np });
    currentProfile.pass = np;
    showMsg('pf-msg','âœ… ContraseÃ±a actualizada.');
    document.getElementById('new-pass').value = '';
  } catch(e) {
    showMsg('pf-err', e.message, true);
  }
}
