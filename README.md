# Constancia

App de seguimiento de hábitos instalable (PWA) para Android y computador, con sincronización en Firebase.

- `src/`: `app.js` (lógica y vistas), `app.css` (diseño), `body.html`, `sync.js` (inicio de sesión con Google y Firestore), `sw.js` (uso sin conexión).
- `npm run build` genera `public/` (lo que se publica) y `preview.html` (vista de prueba sin nube).
- Cada push a `main` publica en Firebase Hosting (`.github/workflows/deploy.yml`). Las reglas de `firestore.rules` se pegan en la consola de Firebase (Firestore → Reglas). Requiere el secreto `FIREBASE_SERVICE_ACCOUNT` en el repositorio.

Los datos de cada persona se guardan en `users/{uid}` y las reglas (`firestore.rules`) solo dejan leerlos y escribirlos a su dueño.
