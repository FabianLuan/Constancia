/* Notas de versión. Al publicar un cambio, agrega una entrada arriba.
   apk: versión mínima de la app Android necesaria (sube este número junto con android/NATIVE_REV cuando cambie algo nativo). */
const CHANGELOG = [
  { v: '1.9.2', date: '2026-11-18', apk: 2, items: ['Desliza hacia abajo en la parte de arriba para recargar la app.', 'La pantalla respeta la barra de notificaciones de tu celular.', 'Nueva app Android con ese ajuste: descárgala e instálala encima.'] },
  { v: '1.9', date: '2026-11-18', apk: 1, items: ['App para Android: los recordatorios se programan en el celular y llegan sin internet.', 'La app se actualiza sola al abrirla.', 'Notas de versión como esta al haber novedades.'] },
  { v: '1.8', date: '2026-11-17', items: ['Nuevo apartado Enfoque: Pomodoro, tareas de la sesión y minutos de concentración.', 'Transiciones más suaves entre pantallas.', '"Ayer llegaste a X, hoy supéralo" y gráfico de avance por hábito.', 'La barra del contador se puede arrastrar.'] },
  { v: '1.7', date: '2026-11-17', items: ['Tarjetas de hábito con tu color.', 'Paleta ampliada y selector de color libre.', 'Selector de emojis para el ícono.'] },
];
const APP_VERSION = CHANGELOG[0].v;
const APK_MIN = Math.max(...CHANGELOG.map(c => c.apk || 0));
const APK_URL = 'https://github.com/FabianLuan/Constancia/releases/download/android/Constancia.apk';
