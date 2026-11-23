import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, query, orderByChild, startAt, endAt, onValue, update, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig, DEMO_MODE } from "./config.js";
import { parseSeguimiento, mapsUrl, waUrl, hashPin, nuevaSal } from "./seguridad.js";
import { DEMO_PEDIDOS } from "./demo-data.js";

const $ = s => document.querySelector(s);
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getDatabase(app);
let unsubs = [], pedidos = {}, drafts = {}, busy = new Set(), tab = 2, lastAct = 0, pend = false, aviso = "", enDemo = false;
let pinData = null, pinFails = 0, pinLockUntil = 0;

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const link = (href, text, cls) => { const l = el("a", cls, text); l.href = href; l.target = "_blank"; l.rel = "noopener noreferrer"; return l; };
function vista(v) {
  ["carga", "login", "pendiente", "app"].forEach(id => $("#" + id).hidden = v !== id);
  $("#bar").hidden = v !== "app";
  if (v !== "pendiente") $("#pendErr").textContent = "";
}
function setConn(ok) { $("#estado").classList.toggle("on", ok); $("#estadoTxt").textContent = ok ? "En línea, disponible" : "Sin conexión"; }

/* Modal de NIP, reutilizado para crear, cambiar y autorizar. validar(pin) -> true | "mensaje de error" */
function abrirPin({ titulo, desc = "", confirmar = false, textoOk = "Confirmar", sinCancelar = false, validar }) {
  return new Promise(resolve => {
    const ov = $("#pinModal"), i1 = $("#pinInput"), i2 = $("#pinInput2"), err = $("#pinErr"), ok = $("#pinOk"), cv = $("#pinCancel");
    $("#pinTitle").textContent = titulo; $("#pinDesc").textContent = desc;
    i1.value = ""; i2.value = ""; err.textContent = ""; i2.hidden = !confirmar; ok.textContent = textoOk; cv.hidden = sinCancelar; ok.disabled = false;
    ov.hidden = false; setTimeout(() => i1.focus(), 50);
    function cerrar(v) { ov.hidden = true; ok.onclick = null; cv.onclick = null; resolve(v); }
    cv.onclick = () => cerrar(null);
    ok.onclick = async () => {
      const p1 = i1.value.trim(), p2 = i2.value.trim();
      if (!/^\d{4,6}$/.test(p1)) { err.textContent = "El NIP debe tener de 4 a 6 dígitos."; return; }
      if (confirmar && p1 !== p2) { err.textContent = "Los NIP no coinciden."; i2.value = ""; i2.focus(); return; }
      if (validar) {
        ok.disabled = true; const r = await validar(p1); ok.disabled = false;
        if (r !== true) { err.textContent = r; i1.value = ""; i1.focus(); return; }
      }
      cerrar(p1);
    };
  });
}

/* Obliga a tener un NIP antes de poder autorizar nada */
async function exigirCrearPin() {
  while (!pinData) {
    const pin = await abrirPin({ titulo: "Crea tu NIP", desc: "Lo usarás para confirmar que recogiste o entregaste un pedido. Solo tú debes conocerlo.", confirmar: true, textoOk: "Guardar NIP", sinCancelar: true });
    const salt = nuevaSal(), hash = await hashPin(pin, salt);
    try { await set(ref(db, "pines/" + auth.currentUser.uid), { hash, salt, actualizadoEn: Date.now() }); pinData = { hash, salt }; }
    catch { /* sin conexión o sin permiso: se vuelve a pedir */ }
  }
}

/* Pide el NIP y lo compara por hash; nunca se guarda ni se envía el NIP en texto plano */
async function autorizar(titulo) {
  if (!pinData) await exigirCrearPin();
  const pin = await abrirPin({
    titulo, desc: "Ingresa tu NIP para autorizar esta acción.", textoOk: "Autorizar",
    validar: async p => {
      if (Date.now() < pinLockUntil) return "Demasiados intentos. Espera unos segundos e inténtalo de nuevo.";
      if ((await hashPin(p, pinData.salt)) === pinData.hash) { pinFails = 0; return true; }
      pinFails++;
      if (pinFails >= 5) { pinLockUntil = Date.now() + 30000; pinFails = 0; return "Demasiados intentos. Espera 30 segundos e inténtalo de nuevo."; }
      return "NIP incorrecto.";
    }
  });
  return pin !== null;
}

function card(id, p) {
  const c = el("article", "card");
  const head = el("div", "head");
  head.append(el("h2", "num", "#" + String(p.numero ?? id).slice(-6).toUpperCase()), el("span", "badge" + (p.estado === 3 ? " e3" : ""), p.estado === 3 ? "En camino" : "Preparando paquete"));

  const rec = el("section"); rec.append(el("p", "lbl", "Recoger en"), el("p", "big", p.boutique?.nombre || "Boutique"), el("p", "", p.boutique?.calle || ""));
  const ent = el("section"); ent.append(el("p", "lbl", "Entregar a"), el("p", "big", p.cliente?.nombre || "Cliente"), el("p", "", p.cliente?.direccion || ""));
  const acts = el("div", "row");
  acts.append(link(mapsUrl(p.cliente?.direccion || ""), "Abrir en Maps", "btn dark"));
  const w = waUrl(p.cliente?.telefono);
  acts.append(w ? link(w, "WhatsApp", "btn") : el("span"));
  ent.append(acts);

  const f = el("section"), inpId = "s-" + id, err = el("p", "err"); err.setAttribute("role", "alert");
  const lab = el("label", "lbl", "Enlace de seguimiento o código"); lab.htmlFor = inpId;
  const inp = document.createElement("input");
  Object.assign(inp, { id: inpId, type: "text", maxLength: 300, autocomplete: "off", autocapitalize: "off", spellcheck: false, placeholder: "https://… o código" });
  inp.value = drafts[id] ?? (typeof p.seguimiento === "string" ? p.seguimiento : "");
  inp.addEventListener("input", () => { drafts[id] = inp.value; err.textContent = ""; });
  const pegar = el("button", "btn", "Pegar"); pegar.type = "button";
  pegar.onclick = async () => { try { inp.value = (await navigator.clipboard.readText()).trim().slice(0, 300); drafts[id] = inp.value; } catch { /* sin permiso de portapapeles */ } };
  const r = el("div", "row1"); r.append(inp, pegar);
  f.append(lab, r, err);
  const seg = parseSeguimiento(p.seguimiento);
  if (seg.value && seg.value.startsWith("https://")) f.append(link(seg.value, "Abrir seguimiento guardado", "btn"));

  const cta = el("button", "btn cta " + (p.estado === 2 ? "pri" : "dark"), p.estado === 2 ? "Marcar en camino" : "Marcar entregado");
  cta.type = "button"; cta.disabled = busy.has(id);
  cta.onclick = () => avanzar(id, inp, err, cta);
  c.append(head, rec, ent, f, cta);
  return c;
}

function render() {
  const L = $("#lista");
  if (L.contains(document.activeElement) && document.activeElement.tagName === "INPUT") { pend = true; return; }
  pend = false;
  const uid = enDemo ? "demo-uid" : auth.currentUser?.uid;
  const ids = Object.keys(pedidos).filter(id => { const p = pedidos[id]; return p && (p.estado === 2 || (p.estado === 3 && p.repartidorUid === uid)); })
    .sort((a, b) => (pedidos[a].creadoEn || 0) - (pedidos[b].creadoEn || 0));
  const por = ids.filter(id => pedidos[id].estado === 2), mios = ids.filter(id => pedidos[id].estado === 3);
  $("#c2").textContent = por.length; $("#c3").textContent = mios.length;
  const show = tab === 2 ? por : mios;
  L.replaceChildren(...(show.length ? show.map(id => card(id, pedidos[id])) : [el("p", "vacio", tab === 2 ? "No hay paquetes por recoger. La lista se actualiza sola." : "No tienes entregas en camino.")]));
}
$("#lista").addEventListener("focusout", () => setTimeout(() => { if (pend) render(); }, 700));
document.querySelectorAll(".tabs .btn").forEach(b => b.onclick = () => {
  tab = Number(b.dataset.t);
  document.querySelectorAll(".tabs .btn").forEach(x => x.setAttribute("aria-selected", String(x === b)));
  render();
});

/* Flujo de estados 2 -> 3 -> 4 (las reglas de Firebase lo vuelven a imponer en el servidor) */
async function avanzar(id, inp, err, btn) {
  const p = pedidos[id];
  if (!p || busy.has(id) || Date.now() - lastAct < 1200) return;
  const next = p.estado === 2 ? 3 : p.estado === 3 ? 4 : null;
  if (!next || (!enDemo && !auth.currentUser)) return;
  const s = parseSeguimiento(inp.value);
  if (!s.ok) { err.textContent = "Pega un enlace que empiece con https:// o un código de letras y números."; inp.focus(); return; }
  err.textContent = "";
  if (enDemo) {
    pedidos[id] = { ...p, estado: next, repartidorUid: "demo-uid", actualizadoEn: Date.now(), ...(s.value ? { seguimiento: s.value } : {}) };
    delete drafts[id]; render();
    return;
  }
  btn.disabled = true;
  const autorizado = await autorizar(next === 3 ? "Confirmar recolección" : "Confirmar entrega");
  if (!autorizado) { btn.disabled = busy.has(id); return; }
  busy.add(id); lastAct = Date.now(); btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.textContent = "Guardando…";
  try {
    const b = "pedidos/" + id + "/";
    const up = { [b + "estado"]: next, [b + "repartidorUid"]: auth.currentUser.uid, [b + "actualizadoEn"]: serverTimestamp() };
    if (s.value) up[b + "seguimiento"] = s.value;
    await update(ref(db), up);
    delete drafts[id];
  } catch (e) {
    err.textContent = e && e.code === "PERMISSION_DENIED" ? "Este pedido ya cambió o lo tomó otro repartidor." : "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.";
  } finally { busy.delete(id); render(); }
}

/* Control de acceso: nada de datos hasta tener sesión y rol de repartidor */
function attach() {
  const q = query(ref(db, "pedidos"), orderByChild("estado"), startAt(2), endAt(3));
  unsubs.push(onValue(q, s => { pedidos = s.val() || {}; render(); },
    () => $("#lista").replaceChildren(el("p", "vacio", "Sin permiso para ver pedidos. Avisa al administrador."))));
  unsubs.push(onValue(ref(db, ".info/connected"), s => setConn(s.val() === true)));
}
function detach() {
  unsubs.forEach(f => f()); unsubs = []; pedidos = {}; drafts = {}; busy.clear();
  pinData = null; pinFails = 0; pinLockUntil = 0;
  $("#lista").replaceChildren(); setConn(false);
}

onAuthStateChanged(auth, async user => {
  if (enDemo) return;
  detach();
  if (!user) { vista("login"); $("#loginErr").textContent = aviso; aviso = ""; return; }
  await verificar(user);
});
async function verificar(user) {
  try {
    const r = await get(ref(db, "repartidores/" + user.uid));
    if (auth.currentUser?.uid !== user.uid) return false;
    if (r.val() !== true) { vista("pendiente"); return false; }
  } catch { aviso = "No se pudo verificar tu cuenta."; await signOut(auth); return false; }
  detach(); vista("app"); attach(); $("#ajustes").hidden = false;
  try { pinData = (await get(ref(db, "pines/" + user.uid))).val(); } catch { pinData = null; }
  if (!pinData) await exigirCrearPin();
  return true;
}

function salir() {
  if (enDemo) {
    enDemo = false; pedidos = {}; drafts = {}; busy.clear();
    $("#bar").classList.remove("demo");
    $("#lista").replaceChildren();
    vista("login");
    return;
  }
  signOut(auth);
}
$("#salir").onclick = salir;
$("#salir2").onclick = salir;

if (DEMO_MODE) {
  $("#demoBox").hidden = false;
  $("#demoBtn").onclick = () => {
    enDemo = true; drafts = {}; busy.clear(); tab = 2;
    pedidos = JSON.parse(JSON.stringify(DEMO_PEDIDOS));
    $("#bar").classList.add("demo"); $("#ajustes").hidden = true;
    $("#estadoTxt").textContent = "Vista previa — los cambios no se guardan";
    document.querySelectorAll(".tabs .btn").forEach(x => x.setAttribute("aria-selected", x.dataset.t === "2" ? "true" : "false"));
    vista("app"); render();
  };
}

let modo = "login";
function setModo(m) {
  modo = m; const reg = m === "registro";
  document.querySelectorAll(".reg").forEach(n => n.hidden = !reg);
  $("#entrar").textContent = reg ? "Crear cuenta" : "Entrar";
  $("#modo").textContent = reg ? "Ya tengo cuenta" : "Crear cuenta";
  $("#pass").autocomplete = reg ? "new-password" : "current-password";
  $("#loginErr").textContent = "";
}
$("#modo").onclick = () => setModo(modo === "login" ? "registro" : "login");

$("#cambiarPin").onclick = async () => {
  if (pinData) {
    const ok = await abrirPin({
      titulo: "Verifica tu NIP actual", desc: "Ingresa tu NIP actual para poder cambiarlo.", textoOk: "Continuar",
      validar: async p => (await hashPin(p, pinData.salt)) === pinData.hash ? true : "NIP incorrecto."
    });
    if (ok === null) return;
  }
  let guardado = false;
  while (!guardado) {
    const nuevo = await abrirPin({ titulo: "Nuevo NIP", desc: "Escríbelo dos veces para confirmarlo.", confirmar: true, textoOk: "Guardar NIP" });
    if (nuevo === null) return;
    const salt = nuevaSal(), hash = await hashPin(nuevo, salt);
    try { await set(ref(db, "pines/" + auth.currentUser.uid), { hash, salt, actualizadoEn: Date.now() }); pinData = { hash, salt }; guardado = true; }
    catch { /* sin conexión: se vuelve a mostrar el modal */ }
  }
};

$("#verificar").onclick = async () => {
  const b = $("#verificar"), u = auth.currentUser; if (b.disabled || !u) return;
  b.disabled = true; $("#pendErr").textContent = "";
  const ok = await verificar(u);
  if (!ok && !$("#pendiente").hidden) $("#pendErr").textContent = "Todavía no está aprobada. Inténtalo más tarde.";
  b.disabled = false;
};

const msgAuth = (c, reg) => c === "auth/too-many-requests" ? "Demasiados intentos. Espera unos minutos."
  : c === "auth/email-already-in-use" ? "Ya existe una cuenta con ese correo."
  : c === "auth/weak-password" ? "Elige una contraseña más larga."
  : c === "auth/invalid-email" ? "Escribe un correo válido."
  : reg ? "No se pudo crear la cuenta. Inténtalo de nuevo." : "Correo o contraseña incorrectos.";

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const b = $("#entrar"); if (b.disabled) return;
  const err = $("#loginErr"), reg = modo === "registro";
  const email = $("#email").value.trim(), pass = $("#pass").value;
  let nombre, tel;
  if (reg) {
    nombre = $("#nombre").value.trim().replace(/\s+/g, " "); tel = $("#tel").value.replace(/\D/g, "").slice(-10);
    const m = nombre.length < 2 || nombre.length > 60 ? "Escribe tu nombre completo."
      : !/^\d{10}$/.test(tel) ? "Escribe tu teléfono de 10 dígitos."
      : !$("#email").checkValidity() ? "Escribe un correo válido."
      : pass.length < 8 ? "La contraseña debe tener al menos 8 caracteres."
      : pass !== $("#pass2").value ? "Las contraseñas no coinciden." : "";
    if (m) { err.textContent = m; return; }
  }
  b.disabled = true; b.textContent = reg ? "Creando…" : "Entrando…"; err.textContent = "";
  try {
    if (!reg) await signInWithEmailAndPassword(auth, email, pass);
    else {
      const { user } = await createUserWithEmailAndPassword(auth, email, pass);
      try { await set(ref(db, "solicitudes/" + user.uid), { nombre, telefono: tel, email: user.email, creadoEn: serverTimestamp() }); }
      catch { $("#pendErr").textContent = "Tu cuenta se creó, pero no se envió tu solicitud. Avisa al administrador con tu correo."; }
    }
  } catch (er) { err.textContent = msgAuth(er && er.code, reg); }
  finally { b.disabled = false; b.textContent = modo === "registro" ? "Crear cuenta" : "Entrar"; $("#pass").value = ""; $("#pass2").value = ""; }
});
