// Sincronización con Firebase: inicio de sesión con Google y un documento por usuario en Firestore.
// Firestore guarda los cambios sin conexión y los sube cuando vuelve internet.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

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

const C = { user: null, status: 'idle', error: '' };
let ref = null, unsub = null, timer = null, lastPushed = 0, applying = false;
const rerender = () => { try { window.Constancia.render(); } catch (e) { } };
const strip = s => { const o = JSON.parse(JSON.stringify(s)); delete o.theme; return o; };

function push(state) {
  if (!ref || applying) return;
  C.status = navigator.onLine ? 'pending' : 'offline';
  clearTimeout(timer);
  timer = setTimeout(() => {
    lastPushed = state.updatedAt || Date.now();
    setDoc(ref, { data: JSON.stringify(strip(state)), updatedAt: lastPushed, savedAt: serverTimestamp() })
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
  if (user) attach(user);
  rerender();
});
getRedirectResult(auth).catch(err => { C.error = 'No se pudo iniciar sesión: ' + (err.code || err.message); rerender(); });

C.push = push;
C.signIn = async () => {
  C.error = '';
  const provider = new GoogleAuthProvider();
  try { await signInWithPopup(auth, provider); }
  catch (err) {
    if (/popup-blocked|operation-not-supported|popup-closed-by-browser/.test(err.code || '')) return signInWithRedirect(auth, provider);
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') { C.error = 'No se pudo iniciar sesión: ' + (err.code || err.message); rerender(); }
  }
};
C.signOut = () => signOut(auth);
window.addEventListener('online', () => { if (ref) { C.status = 'pending'; rerender(); push(window.Constancia.state); } });
window.addEventListener('offline', () => { if (ref) { C.status = 'offline'; rerender(); } });

window.ConstanciaSync = C;
rerender();
