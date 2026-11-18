// Sincronización con Firebase: inicio de sesión con Google y un documento por usuario en Firestore.
// Firestore guarda los cambios sin conexión y los sube cuando vuelve internet.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential, signOut } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { LocalNotifications } from '@capacitor/local-notifications';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, onSnapshot, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyC0ADsEuPdGIbTsgnobo6shNXJ5SxxRaR8',
  authDomain: 'constancia-habit-tracker.firebaseapp.com',
  projectId: 'constancia-habit-tracker',
  storageBucket: 'constancia-habit-tracker.firebasestorage.app',
  messagingSenderId: '878718213941',
  appId: '1:878718213941:web:6d4501b0d32e5cf757767c',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'es';
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

const NATIVE = Capacitor.isNativePlatform();
const WEB_URL = 'https://constancia-habit-tracker.web.app/';
const C = { user: null, status: 'idle', error: '', native: NATIVE };
let ref = null, unsub = null, timer = null, lastPushed = 0, applying = false;
const rerender = () => { try { window.Constancia.render(); } catch (e) { } };
const strip = s => { const o = JSON.parse(JSON.stringify(s)); delete o.theme; return o; };

function push(state) {
  if (!ref || applying) return;
  C.status = navigator.onLine ? 'pending' : 'offline';
  clearTimeout(timer);
  timer = setTimeout(() => {
    lastPushed = state.updatedAt || Date.now();
    setDoc(ref, { data: JSON.stringify(strip(state)), updatedAt: lastPushed, savedAt: serverTimestamp() }, { merge: true })
      .then(() => { C.status = 'synced'; C.error = ''; rerender(); })
      .catch(err => { C.status = 'offline'; C.error = 'No se pudo guardar en la nube: ' + (err.code || err.message); rerender(); });
  }, 600);
}

function adopt(remote) {
  const local = window.Constancia.state;
  applying = true;
  try { window.Constancia.set(Object.assign({}, remote, { theme: local.theme, demo: false })); }
  finally { applying = false; }
}

function attach(user) {
  ref = doc(db, 'users', user.uid);
  let first = true;
  unsub = onSnapshot(ref, snap => {
    const local = window.Constancia.state;
    if (!snap.exists()) {
      // Primera vez en la nube: sube lo que hay aquí (si son datos de ejemplo, parte en limpio).
      if (local.demo) window.Constancia.set({ theme: local.theme });
      push(Object.assign({}, window.Constancia.state, { updatedAt: Date.now() }));
    } else {
      const d = snap.data();
      const remoteAt = d.updatedAt || 0;
      if (first && !local.demo && (local.updatedAt || 0) > remoteAt) push(local);
      else if (remoteAt !== lastPushed && (local.demo || remoteAt > (local.updatedAt || 0) || first)) {
        try { adopt(JSON.parse(d.data)); } catch (e) { C.error = 'Los datos de la nube están dañados.'; }
      }
      C.status = snap.metadata.hasPendingWrites ? 'pending' : (snap.metadata.fromCache && !navigator.onLine ? 'offline' : 'synced');
    }
    first = false;
    rerender();
  }, err => { C.error = 'Sin acceso a la nube: ' + (err.code || err.message); C.status = 'offline'; rerender(); });
}

onAuthStateChanged(auth, user => {
  if (unsub) { unsub(); unsub = null; } ref = null;
  C.user = user ? { name: user.displayName, email: user.email } : null;
  C.status = user ? 'connecting' : 'idle';
  if (user) { attach(user); if (localStorage.getItem(PK) && typeof Notification !== 'undefined' && Notification.permission === 'granted') registerToken().catch(() => { }); }
  rerender();
});
getRedirectResult(auth).catch(err => { C.error = 'No se pudo iniciar sesión: ' + (err.code || err.message); rerender(); });

C.push = push;
C.signIn = async () => {
  C.error = '';
  // En la app Android, Google no permite iniciar sesión dentro de la app: se abre Chrome y vuelve con el token.
  if (NATIVE) { await Browser.open({ url: WEB_URL + '?applogin=1' }); return; }
  const provider = new GoogleAuthProvider();
  try { await signInWithPopup(auth, provider); }
  catch (err) {
    if (/popup-blocked|operation-not-supported|popup-closed-by-browser/.test(err.code || '')) return signInWithRedirect(auth, provider);
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') { C.error = 'No se pudo iniciar sesión: ' + (err.code || err.message); rerender(); }
  }
};
C.signOut = async () => { await C.disablePush().catch(() => { }); return signOut(auth); };

// Notificaciones push: el token de este dispositivo se guarda en users/{uid}.push.tokens; una tarea programada envía los avisos.
const PK = 'constancia.push';
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Santiago'; } catch (e) { return 'America/Santiago'; } };
const keyOf = t => t.replace(/[^A-Za-z0-9]/g, '').slice(-24);
let msg = null;
async function messaging() {
  if (msg) return msg;
  if (!('serviceWorker' in navigator) || typeof Notification === 'undefined' || !(await isSupported().catch(() => false))) return null;
  return (msg = getMessaging(app));
}
async function registerToken() {
  const m = await messaging(); if (!m || !ref) return null;
  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(m, { serviceWorkerRegistration: reg });
  if (!token) return null;
  const k = keyOf(token), old = localStorage.getItem(PK);
  const upd = { push: { tz: tz(), tokens: { [k]: { t: token, at: Date.now(), ua: navigator.userAgent.slice(0, 120) } } } };
  await setDoc(ref, upd, { merge: true });
  if (old && old !== k) await updateDoc(ref, { [`push.tokens.${old}`]: deleteField() }).catch(() => { });
  localStorage.setItem(PK, k);
  return k;
}
C.enablePush = async () => {
  if (!ref) return 'login';
  if (!(await messaging())) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  return (await registerToken()) ? 'ok' : 'error:sin token';
};
C.disablePush = async () => {
  const k = localStorage.getItem(PK); localStorage.removeItem(PK);
  if (k && ref) await updateDoc(ref, { [`push.tokens.${k}`]: deleteField() }).catch(() => { });
  const m = await messaging(); if (m) await deleteToken(m).catch(() => { });
};
window.addEventListener('online', () => { if (ref) { C.status = 'pending'; rerender(); push(window.Constancia.state); } });
window.addEventListener('offline', () => { if (ref) { C.status = 'offline'; rerender(); } });

// ---------- app Android ----------
if (NATIVE) {
  App.addListener('appUrlOpen', async ({ url }) => {
    if (!url || !url.startsWith('constancia://auth')) return;
    const q = new URLSearchParams(url.split('?')[1] || '');
    try { await Browser.close(); } catch (e) { }
    try { await signInWithCredential(auth, GoogleAuthProvider.credential(q.get('id') || null, q.get('at') || null)); }
    catch (err) { C.error = 'No se pudo iniciar sesión: ' + (err.code || err.message); rerender(); }
  });
  App.addListener('backButton', () => { const k = window.Constancia && window.Constancia.back && window.Constancia.back(); if (!k) App.minimizeApp(); });
  App.addListener('resume', () => { try { window.Constancia.resume(); } catch (e) { } });
  App.getInfo().then(i => { C.appInfo = i; rerender(); }).catch(() => { });
  LocalNotifications.createChannel({ id: 'habitos', name: 'Recordatorios de hábitos', description: 'Avisos diarios de tus hábitos', importance: 4, visibility: 1, vibration: true }).catch(() => { });
}
// Avisos programados en el propio celular: funcionan sin internet.
const hashId = k => { let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0; return Math.abs(h) % 2000000000 + 1; };
C.openUrl = url => NATIVE ? Browser.open({ url }) : window.open(url, '_blank');
C.local = {
  ok: NATIVE,
  perm: async () => { try { return (await LocalNotifications.checkPermissions()).display; } catch (e) { return 'denied'; } },
  request: async () => { try { const r = await LocalNotifications.requestPermissions(); return r.display; } catch (e) { return 'denied'; } },
  exact: async () => { try { return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm; } catch (e) { return 'granted'; } },
  openExact: async () => { try { await LocalNotifications.changeExactNotificationSetting(); } catch (e) { } },
  count: 0,
  schedule: async plan => {
    if (!NATIVE) return;
    if ((await C.local.perm()) !== 'granted') return;
    const pend = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
    if (pend.notifications.length) await LocalNotifications.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) }).catch(() => { });
    const list = plan.slice(0, 60).map(n => ({ id: hashId(n.key), title: n.title, body: n.body, largeBody: n.body, channelId: 'habitos', smallIcon: 'ic_stat_constancia', iconColor: '#17734A', schedule: { at: new Date(n.at), allowWhileIdle: true } }));
    if (list.length) await LocalNotifications.schedule({ notifications: list }).catch(err => { C.error = 'No se pudieron programar los avisos: ' + (err.message || err); });
    C.local.count = list.length;
  },
  test: async () => { await LocalNotifications.schedule({ notifications: [{ id: 7, title: 'Constancia', body: 'Así te llegarán tus recordatorios, aunque no tengas internet.', channelId: 'habitos', smallIcon: 'ic_stat_constancia', iconColor: '#17734A', schedule: { at: new Date(Date.now() + 4000), allowWhileIdle: true } }] }); },
};
// ---------- página puente para iniciar sesión desde la app Android ----------
if (!NATIVE && new URLSearchParams(location.search).has('applogin')) {
  const box = document.createElement('div');
  box.className = 'applogin';
  const draw = (html) => { box.innerHTML = `<div class="card"><h2>Constancia para Android</h2>${html}</div>`; };
  const ask = () => { draw('<p class="muted">Inicia sesión con tu cuenta de Google para conectar la app.</p><button class="btn pri" id="al-go">Continuar con Google</button>'); box.querySelector('#al-go').onclick = go; };
  const go = async () => {
    try {
      const res = await signInWithPopup(auth, new GoogleAuthProvider());
      const cr = GoogleAuthProvider.credentialFromResult(res);
      const q = new URLSearchParams({ id: cr.idToken || '', at: cr.accessToken || '' }).toString();
      const intent = `intent://auth?${q}#Intent;scheme=constancia;package=cl.constancia.app;end`;
      draw(`<p>Listo, ${res.user.displayName || ''}. Toca el botón para volver a la app.</p><a class="btn pri" href="${intent}">Volver a Constancia</a>`);
      setTimeout(() => { location.href = intent; }, 300);
    } catch (err) { draw(`<p class="err">No se pudo iniciar sesión: ${err.code || err.message}</p><button class="btn pri" id="al-go">Reintentar</button>`); box.querySelector('#al-go').onclick = go; }
  };
  ask(); document.body.appendChild(box);
}

window.ConstanciaSync = C;
rerender();
