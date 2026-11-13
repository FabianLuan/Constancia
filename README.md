# Constancia

App de seguimiento de hábitos instalable (PWA) para Android y computador, con sincronización en Firebase.

- `src/`: `app.js` (lógica y vistas), `app.css` (diseño), `body.html`, `sync.js` (inicio de sesión con Google y Firestore), `sw.js` (uso sin conexión).
- `npm run build` genera `public/` (lo que se publica) y `preview.html` (vista de prueba sin nube).
- Cada push a `main` publica en Firebase Hosting (`.github/workflows/deploy.yml`). Las reglas de `firestore.rules` se pegan en la consola de Firebase (Firestore → Reglas). Requiere el secreto `FIREBASE_SERVICE_ACCOUNT` en el repositorio.

Los datos de cada persona se guardan en `users/{uid}` y las reglas (`firestore.rules`) solo dejan leerlos y escribirlos a su dueño.

## Notificaciones diarias
- En Ajustes › Notificaciones cada dispositivo activa sus avisos (requiere sesión iniciada). El token se guarda en `users/{uid}.push.tokens`.
- Cada hábito tiene "Notificarme cada día" con su hora (por defecto según el momento del día) y hay un resumen diario de pendientes (20:00 por defecto).
- `.github/workflows/notify.yml` ejecuta `scripts/notify.mjs` cada 5 minutos (06:00 a 23:59 hora de Chile) y envía con Firebase Cloud Messaging usando el secreto `FIREBASE_SERVICE_ACCOUNT`. Prueba de permisos: ejecutar el flujo a mano con "check".
