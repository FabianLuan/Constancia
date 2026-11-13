// Envía las notificaciones diarias (recordatorio por hábito y resumen de pendientes) con Firebase Cloud Messaging.
// Lo ejecuta GitHub Actions cada pocos minutos. Uso: node notify.mjs [--check]
import { pathToFileURL } from 'node:url';

const pad = n => String(n).padStart(2, '0');
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const wd = s => (parse(s).getUTCDay() + 6) % 7; // lunes = 0
const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const toMin = hm => +hm.slice(0, 2) * 60 + +hm.slice(3, 5);
export const WINDOW = 120; // minutos de tolerancia si la tarea programada llega tarde

export function localNow(tz, at = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}

// Mismas reglas que la app (src/app.js).
const goalOf = h => (h.type === 'count' || h.type === 'timer') ? Math.max(1, +h.target || 1) * (h.type === 'timer' ? 60 : 1) : 1;
const ent = (S, h, d) => (S.log[d] || {})[h.id] || {};
const isDone = (S, h, d) => (ent(S, h, d).v || 0) >= goalOf(h);
function isDue(h, d) {
  if (d < h.createdAt) return false;
  const f = h.freq || { kind: 'daily' };
  if (f.kind === 'daily') return true;
  if (f.kind === 'days') return (f.days || []).includes(wd(d));
  if (f.kind === 'interval') return diff(h.createdAt, d) % Math.max(1, f.every) === 0;
  if (f.kind === 'weekly') return true; // flexible: cuenta mientras falten veces esta semana
  return false;
}
function weekLeft(S, h, d) {
  const ws = addDays(d, -wd(d)); let n = 0;
  for (let i = 0; i < 7; i++) { const x = addDays(ws, i); if (x !== d && isDone(S, h, x)) n++; }
  return (h.freq.times || 1) - n;
}
export function pendingToday(S, d) {
  return (S.habits || []).filter(h => !h.archived && isDue(h, d) && !isDone(S, h, d) && !ent(S, h, d).s && (h.freq?.kind !== 'weekly' || weekLeft(S, h, d) > 0));
}
const progress = (S, h, d) => {
  const v = ent(S, h, d).v || 0;
  if (h.type === 'timer') return ` (${Math.floor(v / 60)} de ${h.target} min)`;
  if (h.type === 'count') return ` (${v}/${h.target} ${h.unit || ''})`.replace(' )', ')');
  return '';
};

// Decide qué avisos tocan ahora para un usuario. sent = ids ya enviados hoy.
export function dueMessages(S, now, sent = []) {
  const out = [], pend = pendingToday(S, now.date), nm = toMin(now.hm);
  const inWin = hm => hm && /^\d\d:\d\d$/.test(hm) && toMin(hm) <= nm && nm - toMin(hm) <= WINDOW;
  for (const h of pend) {
    if (!inWin(h.reminder) || sent.includes(h.id)) continue;
    out.push({ id: h.id, title: `${h.icon || '⏰'} ${h.name}`, body: `Es tu momento de hoy${progress(S, h, now.date)}. ¡Tú puedes!` });
  }
  const sum = S.notif ? S.notif.summary : '20:00';
  if (inWin(sum) && !sent.includes('_sum') && pend.length) {
    const names = pend.map(h => `${h.icon || ''} ${h.name}`.trim());
    out.push({ id: '_sum', title: pend.length === 1 ? 'Te queda 1 hábito hoy' : `Te quedan ${pend.length} hábitos hoy`, body: names.slice(0, 6).join(' · ') + (names.length > 6 ? ` y ${names.length - 6} más` : '') });
  }
  return out;
}

async function main() {
  const check = process.argv.includes('--check');
  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const { getMessaging } = await import('firebase-admin/messaging');
  initializeApp({ credential: applicationDefault(), projectId: 'constancia-habit-tracker' });
  const db = getFirestore(), fcm = getMessaging();
  const users = await db.collection('users').get();
  let sentCount = 0, withPush = 0;
  for (const doc of users.docs) {
    const u = doc.data(), p = u.push;
    if (!p || !p.tokens || !Object.keys(p.tokens).length || !u.data) continue;
    withPush++;
    let S; try { S = JSON.parse(u.data); } catch { continue; }
    if (S.notif && S.notif.off) continue;
    const now = localNow(p.tz || 'America/Santiago');
    const sent = p.sent && p.sent.d === now.date ? p.sent.ids || [] : [];
    const msgs = dueMessages(S, now, sent);
    if (check) { console.log(`usuario ${doc.id.slice(0, 6)}…: ${Object.keys(p.tokens).length} dispositivo(s), ${msgs.length} aviso(s) ahora`); continue; }
    if (!msgs.length) continue;
    const keys = Object.keys(p.tokens), tokens = keys.map(k => p.tokens[k].t), bad = new Set();
    for (const m of msgs) {
      const r = await fcm.sendEachForMulticast({ tokens, data: { title: m.title, body: m.body, tag: `${m.id}|${now.date}`, url: '/' }, webpush: { headers: { Urgency: 'high', TTL: '7200' } } });
      r.responses.forEach((x, i) => { if (!x.success && /registration-token-not-registered|invalid-argument|invalid-registration-token/.test(x.error?.code || '')) bad.add(keys[i]); });
      sentCount += r.successCount;
    }
    const upd = { 'push.sent': { d: now.date, ids: [...sent, ...msgs.map(m => m.id)] } };
    bad.forEach(k => { upd[`push.tokens.${k}`] = FieldValue.delete(); });
    await doc.ref.update(upd);
  }
  console.log(`${users.size} usuario(s), ${withPush} con avisos activados, ${sentCount} notificación(es) enviada(s)`);
  if (check) { await fcm.send({ topic: 'prueba-permisos', data: { t: '1' } }, true); console.log('Permiso de Cloud Messaging: OK'); }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e.code || '', e.message); process.exit(1); });
