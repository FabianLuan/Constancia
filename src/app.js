(() => {
'use strict';
/* ---------- utilidades ---------- */
const KEY = 'constancia.v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const add = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const wd = s => (parse(s).getDay() + 6) % 7; // lunes = 0
const weekStart = s => add(s, -wd(s));
const today = () => ymd(new Date());
const uid = () => Math.random().toString(36).slice(2, 9);
const DL = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DF = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const longDate = s => { const d = parse(s); return `${DF[wd(s)]} ${d.getDate()} de ${MES[d.getMonth()]}`; };
const shortDate = s => { const d = parse(s); return `${d.getDate()} ${MES[d.getMonth()].slice(0, 3)}`; };
const pct = x => Math.round(x * 100);
const COLORS = ['#2F7ED8', '#D9622B', '#1F9E89', '#8B5CD6', '#A8861A', '#D6457A', '#5C6BC0', '#6B8E23'];
const ICONS = ['✅', '💧', '🦷', '🏃', '🏋️', '🧘', '📖', '✍️', '🥗', '🍎', '😴', '⏰', '🧹', '💊', '🎸', '💻', '🧠', '🚭', '📵', '🍬', '🚿', '🐕', '💰', '🙏'];
const TIMES = [['morning', 'Mañana'], ['afternoon', 'Tarde'], ['evening', 'Noche'], ['any', 'Cualquier momento']];
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/* ---------- estado ---------- */
const blank = () => ({ v: 1, habits: [], log: {}, run: null, pomos: 0, identity: '', theme: 'auto', demo: false, updatedAt: 0 });
function load() { try { const r = localStorage.getItem(KEY); if (r) return Object.assign(blank(), JSON.parse(r)); } catch (e) { } return null; }
let S = load();
const cache = new Map();
function save() {
  S.updatedAt = Date.now(); cache.clear();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
  try { window.ConstanciaSync && window.ConstanciaSync.push(S); } catch (e) { }
}
const U = { tab: 'hoy', day: today(), week: weekStart(today()), month: today().slice(0, 7), sheet: null, form: null, pomo: null, io: null };
const habits = () => S.habits.filter(h => !h.archived);
const byId = id => S.habits.find(h => h.id === id);

/* ---------- reglas de hábitos ---------- */
const entry = (h, d) => (S.log[d] || {})[h.id];
const val = (h, d) => (entry(h, d) || {}).v || 0;
const isSkip = (h, d) => !!(entry(h, d) || {}).s;
const isTimer = h => h.type === 'timer';
const goalOf = h => h.type === 'count' ? Math.max(1, +h.target || 1) : isTimer(h) ? Math.max(1, +h.target || 1) * 60 : 1;
// Cronómetro: segundos guardados + lo que lleva corriendo si está activo.
const running = (h, d) => !!S.run && S.run.h === h.id && S.run.d === d;
const liveSec = (h, d) => val(h, d) + (running(h, d) ? Math.max(0, Math.floor((Date.now() - S.run.at) / 1000)) : 0);
function fmtT(sec) { sec = Math.max(0, Math.floor(sec)); const hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60; return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`; }
function fmtGoal(min) { const hh = Math.floor(min / 60), mm = min % 60; return hh ? (mm ? `${hh} h ${mm} min` : `${hh} h`) : `${mm} min`; }
const amount = (h, v) => isTimer(h) ? fmtGoal(Math.round(v / 60)) : h.type === 'count' ? `${v} ${h.unit}` : 'hecho';
const isDone = (h, d) => val(h, d) >= goalOf(h);
const active = (h, d) => d >= h.createdAt;
const isFlex = h => h.freq.kind === 'weekly';
function isDue(h, d) {
  if (!active(h, d)) return false;
  const f = h.freq;
  if (f.kind === 'daily') return true;
  if (f.kind === 'days') return f.days.includes(wd(d));
  if (f.kind === 'interval') return diff(h.createdAt, d) % Math.max(1, f.every) === 0;
  return false;
}
const canMark = (h, d) => d <= today() && (isDue(h, d) || (isFlex(h) && active(h, d)));
function freqText(h) {
  const f = h.freq;
  if (f.kind === 'daily') return 'Todos los días';
  if (f.kind === 'days') return f.days.length === 7 ? 'Todos los días' : f.days.slice().sort().map(i => DS[i]).join(', ');
  if (f.kind === 'weekly') return `${f.times} ${f.times === 1 ? 'vez' : 'veces'} por semana`;
  return `Cada ${f.every} días`;
}
function weekCount(h, w) { let c = 0; for (let i = 0; i < 7; i++) if (isDone(h, add(w, i))) c++; return c; }
// Secuencia cronológica de ocasiones (días que tocaban, o semanas para "X veces por semana"). Lo pendiente de hoy no cuenta como falla.
function seq(h) {
  if (cache.has(h.id)) return cache.get(h.id);
  const t = today(), out = [];
  if (isFlex(h)) {
    const tw = weekStart(t); let w = weekStart(h.createdAt), first = true;
    while (w <= tw) {
      const need = first ? Math.min(h.freq.times, 7 - wd(h.createdAt)) : h.freq.times;
      const ok = weekCount(h, w) >= need;
      if (w < tw || ok) out.push({ d: w, ok });
      w = add(w, 7); first = false;
    }
  } else {
    let d = h.createdAt;
    while (d <= t) { if (isDue(h, d) && !isSkip(h, d)) { const ok = isDone(h, d); if (d < t || ok) out.push({ d, ok }); } d = add(d, 1); }
  }
  cache.set(h.id, out); return out;
}
// Racha con la regla "nunca falles dos veces": una falla aislada no la corta, dos seguidas sí.
function metrics(h) {
  const k = 'm' + h.id; if (cache.has(k)) return cache.get(k);
  const a = seq(h); let streak = 0, miss = false;
  for (let i = a.length - 1; i >= 0; i--) { if (a[i].ok) { streak++; miss = false; } else { if (miss) break; miss = true; } }
  let best = 0, run = 0, prevMiss = false, str = 0, total = 0, recovered = false;
  const al = isFlex(h) ? 0.7 : 0.88;
  a.forEach((x, i) => {
    if (x.ok) { run++; best = Math.max(best, run); if (prevMiss && i > 1 && a[i - 2].ok) recovered = true; prevMiss = false; }
    else { if (prevMiss) run = 0; prevMiss = true; }
    str = str * al + (x.ok ? 1 : 0) * (1 - al);
  });
  for (const d in S.log) if (isDone(h, d)) total++;
  const last = a[a.length - 1];
  const risk = !!last && !last.ok && streak > 0;
  const m = { streak, best, strength: str, total, risk, recovered, unit: isFlex(h) ? 'sem' : (h.type === 'quit' ? 'días limpio' : 'días') };
  cache.set(k, m); return m;
}
function rangeStats(h, from, to, clamp = true) {
  const end = clamp && to > today() ? today() : to;
  let goal = 0, done = 0, skip = 0, act = 0;
  for (let d = from; d <= end; d = add(d, 1)) {
    if (isFlex(h)) { if (active(h, d)) { act++; if (isDone(h, d)) done++; } }
    else if (isDue(h, d)) { if (isSkip(h, d)) skip++; else { goal++; if (isDone(h, d)) done++; } }
  }
  if (isFlex(h)) goal = act ? Math.max(1, Math.round(h.freq.times * act / 7)) : 0;
  return { goal, done, skip, pct: goal ? Math.min(1, done / goal) : null };
}
function dayPct(d) {
  let g = 0, k = 0;
  for (const h of habits()) {
    if (isDue(h, d)) { if (!isSkip(h, d)) { g++; if (isDone(h, d)) k++; } }
    else if (isFlex(h) && active(h, d) && isDone(h, d)) { g++; k++; }
  }
  return { g, k, p: g ? k / g : null };
}
// Racha de días: días seguidos cumpliendo al menos la mitad de lo programado. Hoy cuenta solo cuando ya llegó a la mitad.
function dayStreak() {
  if (cache.has('ds')) return cache.get('ds');
  const t = today(), first = habits().reduce((m, h) => h.createdAt < m ? h.createdAt : m, t);
  let n = 0;
  for (let d = t; d >= first; d = add(d, -1)) {
    const p = dayPct(d);
    if (!p.g) continue;
    if (p.p >= .5) n++; else if (d !== t) break;
  }
  cache.set('ds', n); return n;
}
const FLAME = '<svg viewBox="0 0 86 104" aria-hidden="true"><defs><linearGradient id="flg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF6B3D"/><stop offset="1" stop-color="#FFC24F"/></linearGradient></defs><path class="f1" d="M43 4c6 18 30 30 30 58a30 30 0 0 1-60 0c0-14 8-22 12-30 2 8 6 12 10 14-2-16 2-30 8-42z"/><path class="f2" d="M43 52c4 8 14 14 14 26a14 14 0 0 1-28 0c0-8 6-12 8-18 2 4 4 6 6 6z"/></svg>';
/* ---------- juego: XP, niveles, logros ---------- */
const TITLES = ['Aprendiz', 'Constante', 'Enfocado', 'Disciplinado', 'Imparable', 'Forjado', 'Maestro', 'Leyenda'];
const lvlAt = n => 100 * n * (n - 1) / 2;
function game() {
  if (cache.has('game')) return cache.get('game');
  const hs = habits(), t = today(); let checks = 0, perfect = 0;
  const start = hs.reduce((m, h) => h.createdAt < m ? h.createdAt : m, t);
  for (let d = start; d <= t; d = add(d, 1)) {
    const p = dayPct(d); if (p.g && p.k === p.g) perfect++;
    for (const h of hs) if (active(h, d) && isDone(h, d)) checks++;
  }
  const ms = hs.map(metrics); const maxS = Math.max(0, ...hs.filter(h => !isFlex(h)).map(h => metrics(h).best));
  const A = [
    ['🌱', 'Primer paso', 'Marca tu primer hábito', checks >= 1],
    ['🔥', 'Semana firme', 'Racha de 7 días', maxS >= 7],
    ['⚒️', 'Mes de hierro', 'Racha de 30 días', maxS >= 30],
    ['🏔️', 'Centenario', 'Racha de 100 días', maxS >= 100],
    ['🎯', 'Día redondo', 'Cumple todo en un día', perfect >= 1],
    ['🗓️', 'Siete redondos', '7 días con todo cumplido', perfect >= 7],
    ['💯', '100 marcas', 'Completa 100 veces', checks >= 100],
    ['🏆', '500 marcas', 'Completa 500 veces', checks >= 500],
    ['🧱', 'Rutina armada', 'Ten 5 hábitos activos', hs.length >= 5],
    ['↩️', 'Nunca dos veces', 'Vuelve justo después de fallar', ms.some(m => m.recovered)],
    ['🔗', 'Cadena', 'Apila un hábito sobre otro', hs.some(h => h.stackAfter && byId(h.stackAfter))],
    ['🍅', 'Foco profundo', '10 sesiones de Pomodoro', S.pomos >= 10],
    ['🕊️', 'Una semana limpio', '7 días en un hábito por dejar', hs.some(h => h.type === 'quit' && metrics(h).best >= 7)],
  ].map(([e, n, t2, ok]) => ({ e, n, t: t2, ok }));
  const un = A.filter(a => a.ok).length;
  const xp = checks * 10 + perfect * 20 + S.pomos * 5 + un * 50;
  const level = Math.floor((1 + Math.sqrt(1 + 8 * xp / 100)) / 2);
  const g = { checks, perfect, A, un, xp, level, title: TITLES[Math.min(7, Math.floor((level - 1) / 2))], into: xp - lvlAt(level), need: lvlAt(level + 1) - lvlAt(level), maxS };
  cache.set('game', g); return g;
}
/* ---------- cambios ---------- */
function setEntry(h, d, patch) {
  const day = S.log[d] || (S.log[d] = {});
  const e = Object.assign({}, day[h.id], patch);
  if (!e.v) delete e.v; if (!e.s) delete e.s; if (!e.n) delete e.n;
  if (Object.keys(e).length) day[h.id] = e; else delete day[h.id];
  if (!Object.keys(day).length) delete S.log[d];
}
function mutate(fn) {
  const g0 = game(), un0 = new Set(g0.A.filter(a => a.ok).map(a => a.n)), t = today(), p0 = dayPct(t);
  fn(); save();
  const p1 = dayPct(t), full = p1.g && p1.k === p1.g && !(p0.g && p0.k === p0.g);
  const g1 = game();
  if (g1.xp > g0.xp) toast(`+${g1.xp - g0.xp} XP`);
  g1.A.filter(a => a.ok && !un0.has(a.n)).forEach(a => toast(`${a.e} Logro: ${a.n}`));
  if (g1.level > g0.level) toast(`⬆️ Nivel ${g1.level} · ${g1.title}`);
  render();
  if (full) celebrate();
}
function celebrate() {
  toast('🔥 Día completo');
  const f = document.querySelector('.flamebox'); if (!f || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  f.classList.remove('up'); void f.offsetWidth; f.classList.add('up');
  for (let k = 0; k < 16; k++) {
    const s = document.createElement('i'); s.className = 'spark'; const a = Math.PI * 2 * k / 16, r = 56 + Math.random() * 34;
    s.style.setProperty('--x', Math.cos(a) * r + 'px'); s.style.setProperty('--y', Math.sin(a) * r + 'px'); if (k % 2) s.style.background = 'var(--hero-accent)';
    f.appendChild(s); setTimeout(() => s.remove(), 600);
  }
}
// Guarda en el día lo que lleva el cronómetro y lo detiene.
function commitRun() {
  if (!S.run) return; const h = byId(S.run.h);
  if (h) setEntry(h, S.run.d, { v: val(h, S.run.d) + Math.max(0, Math.floor((Date.now() - S.run.at) / 1000)), s: 0 });
  S.run = null;
}
function toggle(h, d) {
  if (!canMark(h, d)) return;
  U.just = h.id + '|' + d;
  mutate(() => { if (running(h, d)) S.run = null; if (isSkip(h, d)) setEntry(h, d, { s: 0 }); else setEntry(h, d, { v: isDone(h, d) ? 0 : goalOf(h) }); });
}
function toast(msg) {
  const t = $('#toast'); const el = document.createElement('div'); el.textContent = msg; t.appendChild(el); while (t.children.length > 3) t.firstChild.remove();
  setTimeout(() => el.remove(), 2600);
}
/* ---------- datos de ejemplo ---------- */
function demo() {
  const s = blank(); s.demo = true; s.identity = 'Soy alguien que cumple lo que se propone, un día a la vez.';
  const t = today(), c = add(t, -125); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const H = (o, p) => { const h = Object.assign({ id: uid(), type: 'check', target: 1, unit: '', freq: { kind: 'daily', days: [], times: 3, every: 2 }, time: 'any', reminder: '', stackAfter: '', identity: '', pomodoro: 0, createdAt: c }, o); s.habits.push(h); h._p = p; return h; };
  const a = H({ name: 'Lavarme los dientes', icon: '🦷', color: COLORS[0], time: 'morning' }, .95);
  H({ name: 'Tomar agua', icon: '💧', color: COLORS[2], type: 'count', target: 8, unit: 'vasos' }, .78);
  H({ name: 'Leer', icon: '📖', color: COLORS[3], type: 'timer', target: 20, time: 'evening', pomodoro: 20, stackAfter: a.id, identity: 'Soy lector' }, .7);
  H({ name: 'Gimnasio', icon: '🏋️', color: COLORS[1], freq: { kind: 'weekly', days: [], times: 3, every: 2 }, time: 'afternoon' }, .42);
  H({ name: 'Estudiar inglés', icon: '🧠', color: COLORS[6], type: 'timer', target: 90, freq: { kind: 'days', days: [1, 3], times: 3, every: 2 }, time: 'afternoon', pomodoro: 25 }, .6);
  H({ name: 'Ordenar la pieza', icon: '🧹', color: COLORS[4], freq: { kind: 'days', days: [5], times: 3, every: 2 }, time: 'morning' }, .5);
  H({ name: 'Sin azúcar', icon: '🍬', color: COLORS[5], type: 'quit', time: 'any' }, .84);
  H({ name: 'Dormir antes de las 23:30', icon: '😴', color: COLORS[7], time: 'evening', reminder: '23:00' }, .38);
  for (let d = c; d <= t; d = add(d, 1)) {
    const prog = diff(c, d) / 125, dow = wd(d);
    for (const h of s.habits) {
      const due = h.freq.kind === 'daily' || (h.freq.kind === 'days' && h.freq.days.includes(dow)) || h.freq.kind === 'weekly';
      if (!due) continue;
      let p = h._p + (prog - .5) * .2 - (dow === 3 ? .22 : 0) - (dow >= 5 ? .08 : 0);
      if (h.freq.kind === 'weekly') p = .45;
      if (d === t) p -= .35;
      const r = rnd(); const day = s.log[d] || (s.log[d] = {});
      if (r < p) day[h.id] = { v: h.type === 'count' ? h.target : h.type === 'timer' ? h.target * 60 + Math.floor(rnd() * 600) : 1 };
      else if ((h.type === 'count' || h.type === 'timer') && r < p + .15) day[h.id] = { v: h.type === 'timer' ? Math.ceil(h.target * 30) : Math.ceil(h.target / 2) };
      else if (r > .985 && h.freq.kind !== 'weekly') day[h.id] = { s: 1, n: 'De viaje' };
      if (!Object.keys(day).length) delete s.log[d];
    }
  }
  s.habits.forEach(h => delete h._p); s.pomos = 6;
  const y = add(t, -2); (s.log[y] || (s.log[y] = {}))[s.habits[7].id] = { n: 'Me quedé viendo series hasta tarde.' };
  return s;
}
if (!S) { S = demo(); }

/* ---------- vistas ---------- */
const IC = {
  hoy: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  semana: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M9 5v14M15 5v14"/>',
  mes: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  progreso: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'
};
const TABS = [['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['progreso', 'Progreso'], ['ajustes', 'Ajustes']];
function navHTML() {
  return `<div class="brand">Constanc<i>ia</i></div>` + TABS.map(([k, l]) => `<button class="tab" data-a="tab" data-t="${k}" ${U.tab === k ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>${l}</button>`).join('');
}
function cell(h, d) {
  const t = today(), fut = d > t, ok = isDue(h, d) || (isFlex(h) && active(h, d)), e = entry(h, d) || {};
  let cls = 'c', inner = '', st = 'pendiente';
  if (!ok) { cls += ' off'; st = 'no toca'; }
  else if (e.s) { cls += ' skip'; inner = '–'; st = 'omitido'; }
  else if (isDone(h, d)) { cls += ' done'; inner = CHECK; st = amount(h, e.v); }
  else if (e.v) { cls += ' part'; inner = isTimer(h) ? Math.round(e.v / 60) : e.v; st = isTimer(h) ? `${amount(h, e.v)} de ${fmtGoal(h.target)}` : `${e.v} de ${h.target} ${h.unit}`; }
  else if (d < t && !isFlex(h)) { cls += ' miss'; st = 'no hecho'; }
  if (fut) cls += ' fut';
  const tip = `${esc(h.name)} · ${shortDate(d)} · ${st}`;
  if (U.just === h.id + '|' + d) cls += ' just';
  return `<button class="${cls}" style="--h:${h.color}" data-a="tog" data-h="${h.id}" data-d="${d}" ${!ok || fut ? 'disabled' : ''} aria-label="${tip}" data-tip="${tip}">${inner}</button>`;
}
function ring(p, label) {
  const r = 44, c = 2 * Math.PI * r;
  return `<div class="ring"><svg viewBox="0 0 104 104"><circle class="t" cx="52" cy="52" r="${r}"/><circle class="v" cx="52" cy="52" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - (p || 0))}"/></svg><div class="lab num">${label}</div></div>`;
}
function habitRow(h, d) {
  const m = metrics(h), e = entry(h, d) || {}, done = isDone(h, d), can = canMark(h, d);
  const meta = [];
  if (m.streak > 0) meta.push(`<span class="fire">🔥 ${m.streak} ${m.unit}</span>`);
  if (isFlex(h)) meta.push(`${weekCount(h, weekStart(d))} de ${h.freq.times} esta semana`);
  else if (h.freq.kind !== 'daily') meta.push(freqText(h));
  const st = h.stackAfter && byId(h.stackAfter); if (st) meta.push(`Después de: ${esc(st.name)}`);
  if (m.risk && !done && d === today()) meta.push('<span class="fire">No falles dos veces</span>');
  if (e.n) meta.push('📝 nota');
  let ctl;
  if (e.s) ctl = `<button class="tag" data-a="tog" data-h="${h.id}" data-d="${d}">Omitido · deshacer</button>`;
  else if (isTimer(h)) ctl = timerCtl(h, d, can);
  else if (h.type === 'count') ctl = `<div class="step"><button data-a="dec" data-h="${h.id}" data-d="${d}" aria-label="Restar" ${can ? '' : 'disabled'}>−</button><div class="q num">${val(h, d)}/${h.target}<small>${esc(h.unit)}</small></div><button data-a="inc" data-h="${h.id}" data-d="${d}" aria-label="Sumar" ${can ? '' : 'disabled'}>+</button></div>`;
  else ctl = `<button class="check ${done ? 'on' : ''}" data-a="tog" data-h="${h.id}" data-d="${d}" aria-pressed="${done}" aria-label="${done ? 'Desmarcar' : 'Marcar'} ${esc(h.name)}" ${can ? '' : 'disabled'}>${CHECK}</button>`;
  return `<div class="row ${done ? 'is-done' : ''} ${U.just === h.id + '|' + d ? 'just' : ''}" style="--h:${h.color}"><div class="chip">${h.icon}</div><button class="body" data-a="detail" data-h="${h.id}"><div class="name"><span class="nt">${esc(h.name)}</span>${h.type === 'quit' ? ' <span class="tag">por dejar</span>' : ''}</div><div class="meta">${meta.join('') || '<span>' + freqText(h) + '</span>'}</div></button>${ctl}</div>`;
}
function timerCtl(h, d, can, big) {
  const on = running(h, d), sec = liveSec(h, d), g = goalOf(h), p = Math.min(1, sec / g);
  return `<div class="tmr ${on ? 'on' : ''} ${big ? 'big' : ''}"><div class="tq num"><b data-live="${h.id}|${d}">${fmtT(sec)}</b><small>de ${fmtGoal(h.target)}</small></div><button class="tbtn" data-a="${on ? 'tpause' : 'tstart'}" data-h="${h.id}" data-d="${d}" style="--p:${p}" data-ring="${h.id}|${d}" aria-label="${on ? 'Pausar' : 'Iniciar'} ${esc(h.name)}" ${can ? '' : 'disabled'}>${on ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'}</button></div>`;
}
function demoBanner() {
  return S.demo ? `<div class="banner demo"><span>Estos son <b>datos de ejemplo</b> para que veas cómo funciona.</span><button class="btn sm" data-a="clean">Empezar con mis hábitos</button></div>` : '';
}
function vHoy() {
  const d = U.day, t = today(), w = weekStart(d), p = dayPct(d), g = game();
  const strip = Array.from({ length: 7 }, (_, i) => { const x = add(w, i), q = dayPct(x); return `<button class="dayb ${x === d ? 'sel' : ''} ${x === t ? 'tod' : ''}" data-a="day" data-d="${x}" aria-label="${longDate(x)}"><span class="l">${DL[i]}</span><span class="rg" style="--p:${x <= t && q.p != null ? pct(q.p) : 0}"><span class="n num">${parse(x).getDate()}</span></span></button>`; }).join('');
  const list = habits().filter(h => isDue(h, d) || (isFlex(h) && active(h, d)));
  const risk = d === t ? list.filter(h => metrics(h).risk && !isDone(h, d) && !isSkip(h, d)) : [];
  const groups = TIMES.map(([k, l]) => { const hs = list.filter(h => h.time === k); return hs.length ? `<section class="group"><div class="eyebrow">${l}</div>${hs.map(h => habitRow(h, d)).join('')}</section>` : ''; }).join('');
  const empty = !habits().length ? `<div class="card"><h2>Crea tu primer hábito</h2><p class="muted">Elige qué quieres hacer y qué días. Después solo tienes que marcarlo.</p><button class="btn pri" data-a="new">+ Nuevo hábito</button></div>` : (!list.length ? `<div class="card muted">No hay hábitos programados para este día.</div>` : '');
  return `${demoBanner()}
  <div class="head"><div><h1>${d === t ? 'Hoy' : DF[wd(d)][0].toUpperCase() + DF[wd(d)].slice(1)}</h1><div class="sub">${longDate(d)}</div></div>
    <div class="pager">${d !== t ? '<button class="btn sm" data-a="day" data-d="' + t + '">Volver a hoy</button>' : ''}<button class="btn pri" data-a="new">+ Hábito</button></div></div>
  <div class="strip"><button class="navbtn" data-a="dshift" data-n="-7" aria-label="Semana anterior">‹</button>${strip}<button class="navbtn" data-a="dshift" data-n="7" aria-label="Semana siguiente">›</button></div>
  <div class="card hero"><div class="flamebox ${dayStreak() ? '' : 'cold'}">${FLAME}<b class="num">${dayStreak()}</b><small>${dayStreak() === 1 ? 'día seguido' : 'días seguidos'}</small></div>
    <div class="hb"><div class="id">${S.identity ? esc(S.identity) : (d === t ? 'Tu día de hoy' : longDate(d))}</div>
    <div class="dprog"><span class="bar"><i style="--from:${U.lastP ?? (p.p || 0)};transform:scaleX(${p.p || 0})"></i></span><span class="num">${p.g ? `${p.k} de ${p.g}` : '–'}</span></div>
    <div class="xp"><span class="lvl">Nv ${g.level} · ${g.title}</span><span class="num">${g.into}/${g.need} XP</span></div></div></div>
  ${risk.length ? `<div class="banner risk"><span><b>No falles dos veces.</b> Ayer se te pasó: ${risk.map(h => esc(h.name)).join(', ')}. Si lo haces hoy, la racha sigue.</span></div>` : ''}
  ${groups}${empty}`;
}
function vSemana() {
  const w = U.week, t = today(), days = Array.from({ length: 7 }, (_, i) => add(w, i)), hs = habits().filter(h => active(h, days[6]));
  let done = 0, goal = 0, perfect = 0;
  hs.forEach(h => { const r = rangeStats(h, w, days[6]); done += Math.min(r.done, r.goal); goal += r.goal; });
  days.forEach(d => { const p = dayPct(d); if (d <= t && p.g && p.k === p.g) perfect++; });
  const g = game();
  const rows = hs.map(h => { const r = rangeStats(h, w, days[6]), full = rangeStats(h, w, days[6], false); return `<tr><th class="hn"><button data-a="detail" data-h="${h.id}"><span class="nm">${h.icon} ${esc(h.name)}</span><small class="num">${r.done} de ${full.goal}<span class="fq"> · ${freqText(h)}</span></small></button></th>${days.map(d => `<td>${cell(h, d)}</td>`).join('')}</tr>`; }).join('');
  return `${demoBanner()}<div class="head"><div><h1>Semana</h1><div class="sub">Marca lo que hiciste. Los días que no tocan aparecen con un punto.</div></div>
    <div class="pager"><button class="navbtn" data-a="wshift" data-n="-7" aria-label="Semana anterior">‹</button><b>${shortDate(w)} – ${shortDate(days[6])}</b><button class="navbtn" data-a="wshift" data-n="7" aria-label="Semana siguiente">›</button></div></div>
  ${hs.length ? `<div class="scrollx" data-k="wk"><table class="grid wgrid"><thead><tr><th class="hn"></th>${days.map((d, i) => `<th class="${d === t ? 'tod' : ''}">${DL[i]}<b class="num">${parse(d).getDate()}</b></th>`).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr><th class="hn eyebrow">Día</th>${days.map(d => { const p = dayPct(d); return `<td class="num">${d <= t && p.p != null ? pct(p.p) + '%' : ''}</td>`; }).join('')}</tr></tfoot></table></div>` : `<div class="card muted">Aún no hay hábitos en esta semana. <button class="btn sm" data-a="new">+ Nuevo hábito</button></div>`}
  <div class="legend"><span><i style="background:var(--accent)"></i>Hecho</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--ink3)"></i>Pendiente</span><span><i style="box-shadow:inset 0 0 0 1px var(--line);border:1px dashed var(--ink3)"></i>No hecho</span><span><i style="background:var(--surface2)"></i>Omitido</span></div>
  <div class="tiles"><div class="tile"><b class="num">${goal ? pct(done / goal) + '%' : '–'}</b><span>cumplimiento de la semana</span></div><div class="tile"><b class="num">${done}<small class="muted" style="font-size:.9rem"> / ${goal}</small></b><span>marcas hechas</span></div><div class="tile"><b class="num">${perfect}</b><span>días con todo cumplido</span></div><div class="tile"><b class="num">🔥 ${Math.max(0, ...hs.filter(h => !isFlex(h)).map(h => metrics(h).streak))}</b><span>mejor racha activa (días)</span></div></div>`;
}
function monthInfo(m) { const [y, mo] = m.split('-').map(Number); const dim = new Date(y, mo, 0).getDate(); return { y, mo, dim, first: `${m}-01`, last: `${m}-${pad(dim)}`, label: `${MES[mo - 1]} ${y}` }; }
const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1, 12); return ymd(d).slice(0, 7); };
function vMes() {
  const M = monthInfo(U.month), P = monthInfo(shiftMonth(U.month, -1)), t = today();
  const days = Array.from({ length: M.dim }, (_, i) => `${U.month}-${pad(i + 1)}`);
  const hs = habits().filter(h => active(h, M.last));
  const bars = days.map(d => { const p = dayPct(d); const v = d <= t && p.p != null ? p.p : null; return `<div class="b ${v == null ? 'z' : ''}" data-tip="${shortDate(d)} · ${v == null ? 'sin datos' : pct(v) + '% (' + p.k + ' de ' + p.g + ')'}" tabindex="0"><i style="height:${v == null ? 0 : Math.max(2, v * 100)}%"></i></div>`; }).join('');
  const stats = hs.map(h => ({ h, r: rangeStats(h, M.first, M.last), full: rangeStats(h, M.first, M.last, false), prev: rangeStats(h, P.first, P.last) })).filter(x => x.full.goal > 0);
  const rows = stats.map(({ h, r, full }) => `<tr><th class="hn"><button data-a="detail" data-h="${h.id}"><span class="nm">${h.icon} ${esc(h.name)}</span></button></th>${days.map(d => `<td class="${wd(d) === 0 ? 'wk' : ''}">${cell(h, d)}</td>`).join('')}<td class="st l num"><span class="pb"><i style="width:${pct(r.pct || 0)}%"></i></span>${r.pct == null ? '–' : pct(r.pct) + '%'}</td><td class="st num">${r.done} / ${r.goal} <span class="muted">· meta ${full.goal}</span></td></tr>`).join('');
  const withP = stats.filter(x => x.r.pct != null).sort((a, b) => b.r.pct - a.r.pct);
  const delta = x => { if (x.prev.pct == null) return '<span class="muted small">nuevo</span>'; const dd = pct(x.r.pct) - pct(x.prev.pct); return dd === 0 ? '<span class="muted small">igual</span>' : `<span class="${dd > 0 ? 'up' : 'down'} small">${dd > 0 ? '▲' : '▼'} ${Math.abs(dd)} pts</span>`; };
  const li = x => `<li><span>${x.h.icon} ${esc(x.h.name)}</span><span class="num" style="white-space:nowrap"><b>${pct(x.r.pct)}%</b> ${delta(x)}</span></li>`;
  const col = (cls, title, sub, xs) => `<div class="card"><span class="pill ${cls}">${title}</span><div class="muted small" style="margin-top:6px">${sub}</div><ul>${xs.length ? xs.map(li).join('') : '<li class="muted">Ninguno este mes</li>'}</ul></div>`;
  const wdS = Array.from({ length: 7 }, () => [0, 0]); days.forEach(d => { if (d > t) return; const p = dayPct(d); wdS[wd(d)][0] += p.k; wdS[wd(d)][1] += p.g; });
  const wdP = wdS.map(([k, g], i) => ({ i, p: g ? k / g : null })).filter(x => x.p != null).sort((a, b) => a.p - b.p);
  let tot = 0, totG = 0; stats.forEach(x => { tot += Math.min(x.r.done, x.r.goal); totG += x.r.goal; });
  const notes = []; days.forEach(d => { for (const h of hs) { const e = entry(h, d); if (e && e.n) notes.push(`<li><span><b>${shortDate(d)}</b> · ${h.icon} ${esc(h.name)}: ${esc(e.n)}</span></li>`); } });
  const insight = wdP.length > 1 ? `Tu día más flojo es el <b>${DF[wdP[0].i]}</b> (${pct(wdP[0].p)}%) y el más fuerte el <b>${DF[wdP[wdP.length - 1].i]}</b> (${pct(wdP[wdP.length - 1].p)}%).` : '';
  return `${demoBanner()}<div class="head"><div><h1>Mes</h1><div class="sub">${M.dim} días · ${totG ? pct(tot / totG) + '% de cumplimiento' : 'sin registros todavía'}</div></div>
    <div class="pager"><button class="navbtn" data-a="mshift" data-n="-1" aria-label="Mes anterior">‹</button><b style="text-transform:capitalize">${M.label}</b><button class="navbtn" data-a="mshift" data-n="1" aria-label="Mes siguiente">›</button></div></div>
  <div class="card"><div class="eyebrow">Progreso diario</div><div class="chart"><div class="gl" style="bottom:100%"><span>100%</span></div><div class="gl" style="bottom:50%"><span>50%</span></div>${bars}</div><div class="axis">${days.map((d, i) => `<span class="num">${(i + 1) % 5 === 0 || i === 0 ? i + 1 : ''}</span>`).join('')}</div></div>
  ${stats.length ? `<div class="scrollx" data-k="mo"><table class="grid mgrid"><thead><tr><th class="hn"></th>${days.map((d, i) => `<th class="${d === t ? 'tod' : ''} ${wd(d) === 0 ? 'wk' : ''}">${DL[wd(d)]}<b class="num" style="font-size:.74rem">${i + 1}</b></th>`).join('')}<th>Cumplido</th><th>Hechos hasta hoy</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="card muted">No hay hábitos activos en este mes.</div>'}
  <div><h2>Diagnóstico del mes</h2><p class="muted" style="margin:4px 0 12px">${insight || 'Con unos días más de registros aparecerá aquí tu resumen.'} La variación compara con ${P.label}.</p>
  <div class="diag">${col('ok', 'Se mantuvo', '80% o más', withP.filter(x => x.r.pct >= .8))}${col('mid', 'En camino', 'entre 50% y 79%', withP.filter(x => x.r.pct >= .5 && x.r.pct < .8))}${col('low', 'A mejorar', 'menos de 50%', withP.filter(x => x.r.pct < .5))}</div></div>
  ${notes.length ? `<div class="card"><div class="eyebrow">Notas del mes</div><ul style="margin:8px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px">${notes.join('')}</ul></div>` : ''}`;
}
function vProgreso() {
  const g = game(), hs = habits(), t = today();
  const wdS = Array.from({ length: 7 }, () => [0, 0]); for (let i = 0; i < 90; i++) { const d = add(t, -i), p = dayPct(d); wdS[wd(d)][0] += p.k; wdS[wd(d)][1] += p.g; }
  const bars = wdS.map(([k, gg], i) => { const v = gg ? k / gg : null; return `<div class="b ${v == null ? 'z' : ''}" data-tip="${DF[i]} · ${v == null ? 'sin datos' : pct(v) + '%'}" tabindex="0"><i style="height:${v == null ? 0 : Math.max(2, v * 100)}%;max-width:44px"></i></div>`; }).join('');
  const rows = hs.map(h => ({ h, m: metrics(h) })).sort((a, b) => b.m.strength - a.m.strength).map(({ h, m }) => `<button class="hrow" data-a="detail" data-h="${h.id}"><span class="nm">${h.icon} ${esc(h.name)}</span><span class="sb bar g" data-tip="Fuerza ${pct(m.strength)}%"><i style="width:${pct(m.strength)}%;background:${h.color}"></i></span><span class="k num"><b>${pct(m.strength)}%</b> fuerza</span><span class="k num"><b>🔥 ${m.streak}</b> / ${m.best}</span></button>`).join('');
  return `${demoBanner()}<div class="head"><div><h1>Progreso</h1><div class="sub">Nivel ${g.level} · ${g.title}</div></div></div>
  <div class="card"><div class="xp" style="margin:0"><span class="lvl">Nv ${g.level}</span><span class="bar"><i style="width:${pct(g.into / g.need)}%"></i></span><span class="num">${g.into} / ${g.need} XP para el nivel ${g.level + 1}</span></div><p class="muted small" style="margin:10px 0 0">Ganas 10 XP por cada hábito cumplido, 20 por un día con todo hecho, 5 por Pomodoro y 50 por logro.</p></div>
  <div class="tiles"><div class="tile"><b class="num">${g.xp}</b><span>XP total</span></div><div class="tile"><b class="num">${g.checks}</b><span>veces cumplido</span></div><div class="tile"><b class="num">${g.perfect}</b><span>días con todo hecho</span></div><div class="tile"><b class="num">🔥 ${g.maxS}</b><span>mejor racha histórica</span></div></div>
  <div><h2>Fuerza de cada hábito</h2><p class="muted" style="margin:4px 0 10px">La fuerza sube cada vez que cumples y baja de a poco cuando fallas. Racha actual / mejor racha a la derecha.</p><div class="hl">${rows || '<div class="card muted">Sin hábitos todavía.</div>'}</div></div>
  <div class="card"><div class="eyebrow">Cumplimiento por día de la semana · últimos 90 días</div><div class="chart"><div class="gl" style="bottom:100%"><span>100%</span></div><div class="gl" style="bottom:50%"><span>50%</span></div>${bars}</div><div class="axis">${DS.map(x => `<span>${x}</span>`).join('')}</div></div>
  <div><h2>Logros <span class="muted num" style="font-weight:500;font-size:.9rem">${g.un} de ${g.A.length}</span></h2><div class="ach" style="margin-top:10px">${g.A.map(a => `<div class="${a.ok ? '' : 'lock'}"><span class="e">${a.e}</span><b>${a.n}</b>${a.t}</div>`).join('')}</div></div>`;
}
function cloudHTML() {
  const C = window.ConstanciaSync;
  if (!C) return '<p class="muted small" style="margin:0">Esta vista de prueba guarda los datos solo en este navegador. En la app instalada puedes iniciar sesión y sincronizar el celular con el computador.</p>';
  const u = C.user;
  if (!u) return `<p class="muted small" style="margin:0">Inicia sesión con Google en el celular y en el computador y tus hábitos quedarán sincronizados en ambos.</p><div><button class="btn sm pri" data-a="login">Iniciar sesión con Google</button></div>${C.error ? `<div class="err">${esc(C.error)}</div>` : ''}`;
  const st = C.status === 'synced' ? 'Sincronizado' : C.status === 'pending' ? 'Guardando cambios…' : C.status === 'offline' ? 'Sin conexión: se sincroniza al volver' : 'Conectando…';
  return `<p class="small" style="margin:0"><b>${esc(u.name || u.email)}</b><br><span class="muted">${esc(u.email || '')}</span></p><p class="small" style="margin:0"><span class="pill ${C.status === 'synced' ? 'ok' : 'mid'}">${st}</span></p><div><button class="btn sm" data-a="logout">Cerrar sesión</button></div>${C.error ? `<div class="err">${esc(C.error)}</div>` : ''}`;
}
function vAjustes() {
  const np = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  return `<div class="head"><div><h1>Ajustes</h1></div></div><div class="set">
  <div class="card"><div class="field"><label for="identity">Mi identidad</label><input class="inp" id="identity" data-f="identity" value="${esc(S.identity)}" placeholder="Soy alguien que…" maxlength="120"><span class="muted small">Aparece en la pantalla de Hoy para recordarte por qué lo haces.</span></div></div>
  <div class="card"><div class="lab eyebrow">Apariencia</div><div class="seg">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, l]) => `<button data-a="theme" data-t="${k}" aria-pressed="${S.theme === k}">${l}</button>`).join('')}</div></div>
  <div class="card"><div class="lab eyebrow">Recordatorios</div><p class="muted small" style="margin:0">Cada hábito puede tener su hora. ${np === 'granted' ? 'Las notificaciones están activadas en este dispositivo.' : np === 'unsupported' ? 'Este navegador no permite notificaciones; verás el aviso dentro de la app.' : 'Activa las notificaciones para recibir el aviso aunque estés en otra pestaña.'}</p>${np === 'default' ? '<div><button class="btn sm" data-a="notif">Activar notificaciones</button></div>' : ''}</div>
  <div class="card"><div class="lab eyebrow">Nube</div>${cloudHTML()}</div>
  <div class="card"><div class="lab eyebrow">Respaldo</div><div class="acts"><button class="btn sm" data-a="exp" data-t="json">Exportar respaldo</button><button class="btn sm" data-a="exp" data-t="csv">Exportar CSV</button><button class="btn sm" data-a="imp">Importar respaldo</button></div>
    ${U.io ? `<div class="field"><label for="io">${U.io.mode === 'imp' ? 'Pega aquí el respaldo y pulsa Importar' : 'Copia este texto y guárdalo en un archivo'}</label><textarea class="inp" id="io" ${U.io.mode === 'imp' ? '' : 'readonly'} style="font:12px ui-monospace,monospace;min-height:120px">${esc(U.io.text)}</textarea><div class="acts">${U.io.mode === 'imp' ? '<button class="btn sm pri" data-a="doimp">Importar</button><label class="btn sm">Elegir archivo<input type="file" id="iofile" accept=".json,application/json" hidden></label>' : '<button class="btn sm pri" data-a="copy">Copiar</button><button class="btn sm" data-a="dl">Descargar archivo</button>'}<button class="btn sm ghost" data-a="ioclose">Cerrar</button></div>${U.io.err ? `<div class="err">${U.io.err}</div>` : ''}</div>` : ''}</div>
  <div class="card"><div class="lab eyebrow">Datos</div><div class="acts"><button class="btn sm" data-a="loaddemo">Cargar datos de ejemplo</button><button class="btn sm danger" data-a="wipe">${U.wipe ? '¿Seguro? Borrar todo' : 'Borrar todo'}</button></div></div></div>`;
}
/* ---------- hojas ---------- */
function heat(h) {
  const t = today(), start = add(weekStart(t), -52 * 7); let s = '';
  for (let d = start; d <= add(weekStart(t), 6); d = add(d, 1)) {
    let c = '';
    if (d > t || !active(h, d)) c = 'n';
    else if (isSkip(h, d)) c = 'sk';
    else { const r = val(h, d) / goalOf(h); c = r >= 1 ? 'l3' : r >= .5 ? 'l2' : r > 0 ? 'l1' : ''; }
    s += `<i class="${c}" data-tip="${shortDate(d)}${val(h, d) ? ' · ' + esc(amount(h, val(h, d))) : ''}"></i>`;
  }
  return s;
}
function sDetail(h) {
  const m = metrics(h), d = U.day > today() ? today() : U.day, e = entry(h, d) || {}, can = canMark(h, d);
  const r30 = rangeStats(h, add(today(), -29), today());
  return `<div class="top"><div style="display:flex;gap:12px;align-items:center;min-width:0"><div class="chip" style="--h:${h.color}">${h.icon}</div><div style="min-width:0"><h2>${esc(h.name)}</h2><div class="muted small">${freqText(h)}${h.type === 'count' ? ` · meta ${h.target} ${esc(h.unit)}` : isTimer(h) ? ` · meta ${fmtGoal(h.target)}` : ''}${h.type === 'quit' ? ' · hábito por dejar' : ''}</div></div></div><button class="btn sm ghost" data-a="close">Cerrar</button></div>
  ${h.identity ? `<div class="muted">“${esc(h.identity)}”</div>` : ''}
  <div class="stats4"><div><b class="num">${m.streak}</b>racha (${m.unit})</div><div><b class="num">${m.best}</b>mejor racha</div><div><b class="num">${pct(m.strength)}%</b>fuerza</div><div><b class="num">${r30.pct == null ? '–' : pct(r30.pct) + '%'}</b>últimos 30 días</div></div>
  <div class="field"><div class="lab">Último año</div><div class="scrollx" data-k="heat" data-end="1" style="padding:10px;--h:${h.color}"><div class="heat">${heat(h)}</div></div></div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="eyebrow">${d === today() ? 'Hoy' : longDate(d)}</div>
    ${can && isTimer(h) ? `${timerCtl(h, d, can, true)}<div class="acts"><button class="btn sm" data-a="tadd" data-h="${h.id}" data-d="${d}" data-n="-300">− 5 min</button><button class="btn sm" data-a="tadd" data-h="${h.id}" data-d="${d}" data-n="300">+ 5 min</button><button class="btn sm" data-a="tadd" data-h="${h.id}" data-d="${d}" data-n="900">+ 15 min</button><button class="btn sm ghost" data-a="treset" data-h="${h.id}" data-d="${d}">${U.treset === h.id ? '¿Seguro? Volver a 0' : 'Reiniciar'}</button></div>` : ''}
    ${can ? `<div class="acts">${isTimer(h) ? '' : h.type === 'count' ? `<div class="step"><button data-a="dec" data-h="${h.id}" data-d="${d}" aria-label="Restar">−</button><div class="q num">${val(h, d)}/${h.target}<small>${esc(h.unit)}</small></div><button data-a="inc" data-h="${h.id}" data-d="${d}" aria-label="Sumar">+</button></div>` : `<button class="btn ${isDone(h, d) ? '' : 'pri'}" data-a="tog" data-h="${h.id}" data-d="${d}">${isDone(h, d) ? 'Desmarcar' : (h.type === 'quit' ? 'Hoy me mantuve' : 'Marcar como hecho')}</button>`}
      <button class="btn" data-a="skip" data-h="${h.id}" data-d="${d}">${e.s ? 'Quitar omitido' : 'Omitir este día'}</button>
      ${h.pomodoro ? `<button class="btn" data-a="pomo" data-h="${h.id}">🍅 Foco ${h.pomodoro} min</button>` : ''}</div>
    <div class="field"><label for="note">Nota del día</label><textarea class="inp" id="note" data-f="note" data-h="${h.id}" data-d="${d}" placeholder="¿Cómo te fue? ¿Qué te lo impidió?">${esc(e.n || '')}</textarea></div>` : '<div class="muted">Este hábito no toca este día.</div>'}
  </div>
  <div class="acts"><button class="btn" data-a="edit" data-h="${h.id}">Editar</button><button class="btn danger" data-a="del" data-h="${h.id}">${U.del === h.id ? '¿Seguro? Eliminar con su historial' : 'Eliminar'}</button></div>`;
}
function sForm() {
  const f = U.form, seg = (key, opts) => `<div class="seg">${opts.map(([k, l]) => `<button type="button" data-a="fset" data-k="${key}" data-v="${k}" aria-pressed="${String(key.split('.').reduce((o, p) => o[p], f)) === String(k)}">${l}</button>`).join('')}</div>`;
  const others = habits().filter(h => h.id !== f.id);
  return `<div class="top"><h2>${f.id ? 'Editar hábito' : 'Nuevo hábito'}</h2><button class="btn sm ghost" data-a="close">Cancelar</button></div>
  <div class="field"><label for="f-name">Nombre</label><input class="inp" id="f-name" data-ff="name" value="${esc(f.name)}" placeholder="Ej. Lavarme los dientes" maxlength="60"></div>
  <div class="field"><div class="lab">Tipo</div><div class="seg">${[['check', 'Sí o no'], ['count', 'Cantidad'], ['quit', 'Por dejar']].map(([k, l]) => `<button type="button" data-a="ftype" data-v="${k}" aria-pressed="${k === 'count' ? (f.type === 'count' || f.type === 'timer') : f.type === k}">${l}</button>`).join('')}</div><span class="muted small">${f.type === 'timer' ? 'Se mide con temporizador: lo inicias, lo pausas y la meta se va llenando; puedes pasarte.' : f.type === 'count' ? 'Para cantidades: vasos de agua, páginas, repeticiones.' : f.type === 'quit' ? 'Marcas cada día que te mantuviste. La racha cuenta tus días limpio.' : 'Lo hiciste o no lo hiciste.'}</span></div>
  ${f.type === 'count' || f.type === 'timer' ? `<label class="switch" for="f-timer"><span><b>Incluir temporizador</b><small>Para metas de tiempo, como estudiar 1 h 30 min.</small></span><input type="checkbox" id="f-timer" data-a="ftimer" ${f.type === 'timer' ? 'checked' : ''}><i aria-hidden="true"></i></label>` : ''}
  ${f.type === 'timer' ? `<div class="field"><div class="lab">Meta diaria de tiempo</div><div class="two"><div class="field"><label for="f-th">Horas</label><input class="inp" id="f-th" type="number" min="0" max="23" inputmode="numeric" data-ff="th" value="${esc(f.th)}"></div><div class="field"><label for="f-tm">Minutos</label><input class="inp" id="f-tm" type="number" min="0" max="59" step="5" inputmode="numeric" data-ff="tm" value="${esc(f.tm)}"></div></div><div class="seg">${[30, 60, 90, 120].map(m => `<button type="button" data-a="fgoal" data-v="${m}" aria-pressed="${+f.th * 60 + +f.tm === m}">${fmtGoal(m)}</button>`).join('')}</div></div>` : ''}
  ${f.type === 'count' ? `<div class="two"><div class="field"><label for="f-target">Meta diaria</label><input class="inp" id="f-target" type="number" min="1" inputmode="numeric" data-ff="target" value="${esc(f.target)}"></div><div class="field"><label for="f-unit">Unidad</label><input class="inp" id="f-unit" data-ff="unit" value="${esc(f.unit)}" placeholder="vasos, min, páginas" maxlength="14"></div></div>` : ''}
  <div class="field"><div class="lab">Frecuencia</div>${seg('freq.kind', [['daily', 'Todos los días'], ['days', 'Días fijos'], ['weekly', 'Veces por semana'], ['interval', 'Cada N días']])}
    ${f.freq.kind === 'days' ? `<div class="seg">${DS.map((l, i) => `<button type="button" data-a="fday" data-v="${i}" aria-pressed="${f.freq.days.includes(i)}">${l}</button>`).join('')}</div>` : ''}
    ${f.freq.kind === 'weekly' ? seg('freq.times', [1, 2, 3, 4, 5, 6].map(n => [n, n + (n === 1 ? ' vez' : ' veces')])) : ''}
    ${f.freq.kind === 'interval' ? seg('freq.every', [2, 3, 4, 5, 7, 14].map(n => [n, 'Cada ' + n])) : ''}</div>
  <div class="field"><div class="lab">Momento del día</div>${seg('time', TIMES)}</div>
  <div class="field"><div class="lab">Ícono</div><div class="seg ic">${ICONS.map(i => `<button type="button" data-a="fset" data-k="icon" data-v="${i}" aria-pressed="${f.icon === i}">${i}</button>`).join('')}</div></div>
  <div class="field"><div class="lab">Color</div><div class="seg col">${COLORS.map((c, i) => `<button type="button" style="--h:${c}" data-a="fset" data-k="color" data-v="${c}" aria-pressed="${f.color === c}" aria-label="Color ${i + 1}"></button>`).join('')}</div></div>
  <div class="two"><div class="field"><label for="f-rem">Recordatorio</label><input class="inp" id="f-rem" type="time" data-ff="reminder" value="${esc(f.reminder)}"></div><div class="field"><label for="f-since">Desde</label><input class="inp" id="f-since" type="date" data-ff="createdAt" max="${today()}" value="${esc(f.createdAt)}"></div></div>
  <div class="field"><label for="f-stack">Apilar después de</label><select class="inp" id="f-stack" data-ff="stackAfter"><option value="">Ninguno</option>${others.map(h => `<option value="${h.id}" ${f.stackAfter === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select><span class="muted small">Encadena este hábito a uno que ya haces: “después de X, hago esto”.</span></div>
  <div class="field"><label for="f-id">Identidad</label><input class="inp" id="f-id" data-ff="identity" value="${esc(f.identity)}" placeholder="Soy una persona que…" maxlength="80"></div>
  <div class="field"><div class="lab">Temporizador Pomodoro</div>${seg('pomodoro', [[0, 'Sin temporizador'], [15, '15 min'], [20, '20 min'], [25, '25 min'], [45, '45 min']])}</div>
  ${U.ferr ? `<div class="err">${U.ferr}</div>` : ''}
  <div class="acts"><button class="btn pri" data-a="fsave" style="flex:1">${f.id ? 'Guardar cambios' : 'Crear hábito'}</button></div>`;
}
/* ---------- render ---------- */
function applyTheme() { const r = document.documentElement; if (S.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme); }
function keepScroll(root, fn) {
  const pos = {}; root.querySelectorAll('.scrollx[data-k]').forEach(el => pos[el.dataset.k] = el.scrollLeft);
  fn();
  root.querySelectorAll('.scrollx[data-k]').forEach(el => { if (el.dataset.k in pos) el.scrollLeft = pos[el.dataset.k]; else if (el.dataset.end) el.scrollLeft = el.scrollWidth; else if (el.dataset.k === 'mo' && U.month === today().slice(0, 7)) { const th = el.querySelector('th.tod'); if (th) el.scrollLeft = Math.max(0, th.offsetLeft - el.clientWidth / 2); } });
}
function render() {
  $('#nav').innerHTML = navHTML();
  const v = $('#view');
  keepScroll(v, () => { v.innerHTML = ({ hoy: vHoy, semana: vSemana, mes: vMes, progreso: vProgreso, ajustes: vAjustes })[U.tab](); });
  if (U.enter) { U.enter = false; v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
  renderSheet();
  U.just = null; U.lastP = dayPct(U.day).p || 0;
}
function renderSheet() {
  const el = $('#sheet');
  clearTimeout(U.outT);
  if (!U.sheet) {
    const sc = el.querySelector('.scrim');
    if (!sc || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.innerHTML = ''; return; }
    sc.classList.add('out'); sc.style.pointerEvents = 'none';
    U.outT = setTimeout(() => { if (!U.sheet) el.innerHTML = ''; }, 200);
    return;
  }
  const h = U.sheet.h && byId(U.sheet.h);
  if (U.sheet.k === 'detail' && !h) { U.sheet = null; el.innerHTML = ''; return; }
  const cur = el.querySelector('.sheet'), top = cur ? cur.scrollTop : 0, same = cur && cur.dataset.k === U.sheet.k;
  keepScroll(el, () => { el.innerHTML = `<div class="scrim${same ? ' still' : ''}" data-a="scrim"><div class="sheet" role="dialog" aria-modal="true" data-k="${U.sheet.k}">${U.sheet.k === 'detail' ? sDetail(h) : sForm()}</div></div>`; });
  if (same) el.querySelector('.sheet').scrollTop = top;
}
/* ---------- pomodoro y recordatorios ---------- */
function tickRun() {
  const bar = $('#run');
  if (!S.run) { if (bar.innerHTML) bar.innerHTML = ''; return; }
  const h = byId(S.run.h); if (!h) { S.run = null; save(); return; }
  const d = S.run.d, sec = liveSec(h, d), g = goalOf(h);
  if (val(h, d) < g && sec >= g) { mutate(() => { commitRun(); S.run = { h: h.id, d, at: Date.now() }; }); toast(`⏱ Meta cumplida: ${h.name}`); beep(); return; }
  document.querySelectorAll(`[data-live="${h.id}|${d}"]`).forEach(el => { el.textContent = fmtT(sec); });
  document.querySelectorAll(`[data-ring="${h.id}|${d}"]`).forEach(el => el.style.setProperty('--p', Math.min(1, sec / g)));
  const html = `<div class="pp"><span>⏱ ${fmtT(sec)}</span><small>${esc(h.name)}</small><button data-a="tpause">Pausar</button></div>`;
  if (bar.innerHTML !== html) bar.innerHTML = html;
}
function tick() {
  tickRun();
  const el = $('#pomo');
  if (U.pomo) {
    const left = Math.max(0, Math.round((U.pomo.end - Date.now()) / 1000)), h = byId(U.pomo.h);
    if (left <= 0 || !h) {
      const p = U.pomo; U.pomo = null; el.innerHTML = '';
      if (h) { beep(); mutate(() => { S.pomos++; const d = today(); if (canMark(h, d)) { if (isTimer(h)) setEntry(h, d, { v: val(h, d) + p.mins * 60, s: 0 }); else if (h.type === 'count' && /min/i.test(h.unit)) setEntry(h, d, { v: val(h, d) + p.mins, s: 0 }); else if (h.type !== 'count') setEntry(h, d, { v: 1, s: 0 }); } }); toast(`🍅 Sesión terminada: ${h.name}`); }
    } else el.innerHTML = `<div class="pp"><span>🍅 ${pad(Math.floor(left / 60))}:${pad(left % 60)}</span><small>${esc(h.name)}</small><button data-a="pomostop">Detener</button></div>`;
  }
  const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`, d = today();
  U.noti = U.noti || {};
  for (const h of habits()) {
    if (!h.reminder || h.reminder > hm || U.noti[h.id] === d || !canMark(h, d) || isDone(h, d) || isSkip(h, d)) continue;
    const mins = now.getHours() * 60 + now.getMinutes() - (+h.reminder.slice(0, 2) * 60 + +h.reminder.slice(3));
    U.noti[h.id] = d; if (mins > 2) continue;
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('Constancia', { body: `${h.icon} ${h.name}` }); } catch (e) { }
    toast(`⏰ ${h.icon} ${h.name}`);
  }
}
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 660; g.gain.setValueAtTime(.2, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .8); o.start(); o.stop(a.currentTime + .8); } catch (e) { } }
/* ---------- respaldo ---------- */
function csv() {
  const q = s => `"${String(s).replace(/"/g, '""')}"`; const rows = [['fecha', 'habito', 'valor', 'meta', 'estado', 'nota'].join(',')];
  Object.keys(S.log).sort().forEach(d => { for (const id in S.log[d]) { const h = byId(id); if (!h) continue; const e = S.log[d][id]; rows.push([d, q(h.name), e.v || 0, goalOf(h), e.s ? 'omitido' : isDone(h, d) ? 'hecho' : 'parcial', q(e.n || '')].join(',')); } });
  return rows.join('\n');
}
function newForm(h) {
  const f = h ? JSON.parse(JSON.stringify(h)) : null;
  if (f) { const m = isTimer(f) ? +f.target : 60; f.th = Math.floor(m / 60); f.tm = m % 60; return f; }
  return Object.assign({ th: 1, tm: 0 },  { id: null, name: '', icon: '✅', color: COLORS[S.habits.length % COLORS.length], type: 'check', target: 8, unit: 'vasos', freq: { kind: 'daily', days: [0, 1, 2, 3, 4], times: 3, every: 2 }, time: 'any', reminder: '', stackAfter: '', identity: '', pomodoro: 0, createdAt: today() });
}
/* ---------- eventos ---------- */
const ACT = {
  tab: e => { if (U.tab !== e.t) U.enter = true; U.tab = e.t; U.io = null; U.wipe = false; render(); window.scrollTo(0, 0); },
  day: e => { U.day = e.d; render(); },
  dshift: e => { U.day = add(U.day, +e.n); render(); },
  wshift: e => { U.week = add(U.week, +e.n); render(); },
  mshift: e => { U.month = shiftMonth(U.month, +e.n); render(); },
  tog: e => toggle(byId(e.h), e.d),
  inc: e => { const h = byId(e.h); U.just = e.h + '|' + e.d; if (canMark(h, e.d)) mutate(() => setEntry(h, e.d, { v: val(h, e.d) + 1, s: 0 })); },
  dec: e => { const h = byId(e.h); if (canMark(h, e.d)) mutate(() => setEntry(h, e.d, { v: Math.max(0, val(h, e.d) - 1) })); },
  skip: e => { const h = byId(e.h); mutate(() => setEntry(h, e.d, isSkip(h, e.d) ? { s: 0 } : { s: 1, v: 0 })); },
  detail: e => { U.sheet = { k: 'detail', h: e.h }; U.del = null; renderSheet(); },
  close: () => { U.sheet = null; U.form = null; U.ferr = ''; renderSheet(); },
  scrim: (e, ev) => { if (ev.target.classList.contains('scrim')) ACT.close(); },
  new: () => { U.form = newForm(); U.ferr = ''; U.sheet = { k: 'form' }; renderSheet(); const i = $('#f-name'); if (i) i.focus(); },
  edit: e => { U.form = newForm(byId(e.h)); U.ferr = ''; U.sheet = { k: 'form' }; renderSheet(); },
  fset: e => { const ks = e.k.split('.'); let o = U.form; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = /^(freq\.times|freq\.every|pomodoro)$/.test(e.k) ? +e.v : e.v; renderSheet(); },
  fday: e => { const a = U.form.freq.days, i = +e.v; U.form.freq.days = a.includes(i) ? a.filter(x => x !== i) : a.concat(i); renderSheet(); },
  fsave: () => {
    const f = U.form; f.name = f.name.trim(); f.target = Math.max(1, Math.round(+f.target) || 1);
    if (!f.name) U.ferr = 'Ponle un nombre al hábito.';
    else if (f.freq.kind === 'days' && !f.freq.days.length) U.ferr = 'Elige al menos un día de la semana.';
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(f.createdAt) || f.createdAt > today()) U.ferr = 'La fecha de inicio no puede ser futura.';
    else U.ferr = '';
    if (U.ferr) return renderSheet();
    if (f.type === 'timer') { const m = Math.max(0, Math.round(+f.th || 0)) * 60 + Math.max(0, Math.round(+f.tm || 0)); if (m < 1) { U.ferr = 'Ponle una meta de al menos 1 minuto.'; return renderSheet(); } f.target = m; f.unit = ''; }
    else if (f.type !== 'count') { f.target = 1; f.unit = ''; }
    delete f.th; delete f.tm; delete f.prevType;
    const isNew = !f.id; U.sheet = isNew ? null : { k: 'detail', h: f.id }; U.form = null;
    mutate(() => { if (isNew) { f.id = uid(); S.habits.push(f); } else S.habits[S.habits.findIndex(h => h.id === f.id)] = f; });
    toast(isNew ? 'Hábito creado' : 'Cambios guardados');
  },
  del: e => { if (U.del !== e.h) { U.del = e.h; return renderSheet(); } U.sheet = null; mutate(() => { if (S.run && S.run.h === e.h) S.run = null; S.habits = S.habits.filter(h => h.id !== e.h); for (const d in S.log) { delete S.log[d][e.h]; if (!Object.keys(S.log[d]).length) delete S.log[d]; } S.habits.forEach(h => { if (h.stackAfter === e.h) h.stackAfter = ''; }); }); toast('Hábito eliminado'); },
  tstart: e => { const h = byId(e.h); if (!canMark(h, e.d)) return; mutate(() => { commitRun(); S.run = { h: h.id, d: e.d, at: Date.now() }; }); },
  tpause: () => { mutate(() => { commitRun(); }); },
  tadd: e => { const h = byId(e.h); if (!canMark(h, e.d)) return; mutate(() => { if (running(h, e.d)) { commitRun(); S.run = { h: h.id, d: e.d, at: Date.now() }; } setEntry(h, e.d, { v: Math.max(0, val(h, e.d) + +e.n), s: 0 }); }); },
  treset: e => { if (U.treset !== e.h) { U.treset = e.h; return renderSheet(); } U.treset = null; const h = byId(e.h); mutate(() => { if (running(h, e.d)) S.run = null; setEntry(h, e.d, { v: 0 }); }); },
  ftimer: () => { const f = U.form; f.type = f.type === 'timer' ? 'count' : 'timer'; renderSheet(); },
  ftype: e => { const f = U.form; if (e.v === 'count' && f.type === 'timer') return; f.type = e.v; renderSheet(); },
  fgoal: e => { U.form.th = Math.floor(+e.v / 60); U.form.tm = +e.v % 60; renderSheet(); },
  pomo: e => { const h = byId(e.h); U.pomo = { h: h.id, mins: h.pomodoro, end: Date.now() + h.pomodoro * 60000 }; U.sheet = null; renderSheet(); tick(); toast(`🍅 ${h.pomodoro} minutos de foco`); },
  pomostop: () => { U.pomo = null; $('#pomo').innerHTML = ''; },
  theme: e => { S.theme = e.t; save(); applyTheme(); render(); },
  login: () => { window.ConstanciaSync && window.ConstanciaSync.signIn(); },
  logout: () => { window.ConstanciaSync && window.ConstanciaSync.signOut(); },
  notif: () => { try { Notification.requestPermission().then(() => render()); } catch (e) { } },
  clean: () => { S = blank(); save(); U.sheet = null; render(); ACT.new(); },
  loaddemo: () => { const th = S.theme; S = demo(); S.theme = th; save(); U.tab = 'hoy'; render(); toast('Datos de ejemplo cargados'); },
  wipe: () => { if (!U.wipe) { U.wipe = true; return render(); } U.wipe = false; const th = S.theme; S = blank(); S.theme = th; save(); render(); toast('Datos borrados'); },
  exp: e => { U.io = { mode: 'exp', type: e.t, text: e.t === 'csv' ? csv() : JSON.stringify(S) }; render(); },
  imp: () => { U.io = { mode: 'imp', text: '' }; render(); },
  ioclose: () => { U.io = null; render(); },
  copy: () => { const ta = $('#io'); const done = () => toast('Copiado'); try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); }); } catch (x) { ta.select(); } },
  dl: () => { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([U.io.text], { type: 'text/plain' })); a.download = `constancia-${today()}.${U.io.type}`; a.click(); } catch (x) { } },
  doimp: () => {
    try { const o = JSON.parse($('#io').value); if (!o || !Array.isArray(o.habits) || typeof o.log !== 'object') throw 0; S = Object.assign(blank(), o); S.demo = false; save(); U.io = null; applyTheme(); render(); toast('Respaldo importado'); }
    catch (x) { U.io.text = $('#io').value; U.io.err = 'Ese texto no es un respaldo válido de Constancia.'; render(); }
  },
};
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]'); if (!el) return;
  const fn = ACT[el.dataset.a]; if (fn) fn(el.dataset, ev);
});
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.dataset.ff && U.form) U.form[el.dataset.ff] = el.value;
  else if (el.dataset.f === 'identity') { S.identity = el.value; save(); }
  else if (el.dataset.f === 'note') { const h = byId(el.dataset.h); if (h) { setEntry(h, el.dataset.d, { n: el.value.trim() }); save(); } }
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.id === 'iofile' && el.files[0]) { const r = new FileReader(); r.onload = () => { U.io.text = String(r.result); U.io.err = ''; render(); }; r.readAsText(el.files[0]); }
  else if (el.dataset.f === 'note') render();
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && U.sheet) ACT.close(); });
const tip = $('#tip');
const showTip = ev => { const el = ev.target.closest && ev.target.closest('[data-tip]'); if (!el) { tip.hidden = true; return; } const r = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.hidden = false; const x = Math.min(window.innerWidth - tip.offsetWidth / 2 - 6, Math.max(tip.offsetWidth / 2 + 6, r.left + r.width / 2)); tip.style.left = x + 'px'; tip.style.top = Math.max(34, r.top) + 'px'; };
document.addEventListener('mouseover', showTip); document.addEventListener('focusin', showTip);
document.addEventListener('mouseout', () => { tip.hidden = true; }); document.addEventListener('scroll', () => { tip.hidden = true; }, true);

applyTheme(); render(); tick(); setInterval(tick, 1000);
let lastDay = today(); setInterval(() => { if (today() !== lastDay) { lastDay = today(); cache.clear(); U.day = lastDay; render(); } }, 60000);
try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && window.top === window && document.querySelector('link[rel="manifest"]')) navigator.serviceWorker.register('sw.js'); } catch (e) { }
window.Constancia = { render, get state() { return S; }, set(o) { S = Object.assign(blank(), o); cache.clear(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } applyTheme(); render(); } };
})();
