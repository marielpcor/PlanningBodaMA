// ===== Planificador Boda M & A — lógica del frontend =====

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  finalizado: 'Finalizado',
};
const STATUS_ORDER = ['pendiente', 'en_proceso', 'finalizado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

let activities = [];
let currentFilter = 'todas';
let calYear, calMonth;        // mes mostrado en el calendario
let selectedDay = null;       // 'YYYY-MM-DD' seleccionado en el calendario

// ---------- Utilidades ----------
function $(id) { return document.getElementById(id); }

function api(path, options) {
  return fetch(path, options).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Error en el servidor.');
    return data;
  });
}

// Formatea 'YYYY-MM-DD' a algo legible. Construye la fecha en horario local
// (sin desfase por zona horaria) usando los componentes directamente.
function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function formatDate(iso) {
  if (!iso) return '';
  const d = parseLocalDate(iso);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}
function isoFromParts(y, m, d) {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}
function todayIso() {
  const n = new Date();
  return isoFromParts(n.getFullYear(), n.getMonth(), n.getDate());
}

// ---------- Carga inicial ----------
async function loadActivities() {
  try {
    const data = await api('/api/activities');
    activities = data.activities || [];
  } catch (e) {
    activities = [];
  }
  renderList();
  renderCalendar();
}

// ---------- Crear actividad ----------
$('activity-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('submit-btn');
  const msg = $('form-msg');
  const title = $('title').value.trim();
  if (!title) { showMsg(msg, 'Escribe el nombre de la actividad.', 'err'); return; }

  btn.disabled = true;
  const payload = {
    title,
    date: $('date').value || null,
    status: $('status').value,
    description: $('description').value.trim(),
  };
  try {
    const { activity } = await api('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    activities.push(activity);
    e.target.reset();
    setStatus('pendiente');
    resetSuggestions();
    showMsg(msg, '¡Actividad agregada! 💐', 'ok');
    renderList();
    renderCalendar();
  } catch (err) {
    showMsg(msg, err.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

// ---------- Sugerencias rápidas + selector de estado ----------
const SUGGESTIONS = [
  'Prueba de vestido', 'Reservar salón', 'Degustación de menú', 'Enviar invitaciones',
  'Sesión de fotos', 'Elegir pastel', 'Música / DJ', 'Flores y decoración',
  'Lista de invitados', 'Comprar anillos',
];

function renderSuggestions() {
  const box = $('suggestions');
  box.innerHTML = '';
  SUGGESTIONS.forEach((text) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'suggestion';
    b.textContent = text;
    b.addEventListener('click', () => {
      const input = $('title');
      input.value = text;
      input.focus();
      input.classList.remove('pulse');
      void input.offsetWidth;        // reinicia la animación
      input.classList.add('pulse');
      document.querySelectorAll('#suggestions .suggestion').forEach((s) => {
        s.classList.toggle('used', s === b);
      });
    });
    box.appendChild(b);
  });
}

function resetSuggestions() {
  document.querySelectorAll('#suggestions .suggestion').forEach((s) => s.classList.remove('used'));
}

function setStatus(s) {
  $('status').value = s;
  document.querySelectorAll('#status-picker .status-opt').forEach((o) => {
    const on = o.dataset.status === s;
    o.classList.toggle('active', on);
    o.setAttribute('aria-checked', String(on));
  });
}

$('status-picker').addEventListener('click', (e) => {
  const opt = e.target.closest('.status-opt');
  if (opt) setStatus(opt.dataset.status);
});

function showMsg(el, text, kind) {
  el.textContent = text;
  el.className = 'form-msg ' + (kind || '');
  if (kind === 'ok') setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 2500);
}

// ---------- Cambios en una actividad ----------
async function updateActivity(id, changes) {
  const { activity } = await api('/api/activities/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  const i = activities.findIndex((a) => String(a.id) === String(id));
  if (i !== -1) activities[i] = activity;
  renderList();
  renderCalendar();
}

async function deleteActivity(id) {
  if (!confirm('¿Eliminar esta actividad?')) return;
  await api('/api/activities/' + encodeURIComponent(id), { method: 'DELETE' });
  activities = activities.filter((a) => String(a.id) !== String(id));
  renderList();
  renderCalendar();
}

// ---------- Render: lista ----------
function activityItemEl(a) {
  const li = document.createElement('li');
  li.className = 'activity-item st-' + a.status;

  const row = document.createElement('div');
  row.className = 'activity-row';

  const marker = document.createElement('span');
  marker.className = 'marker';
  marker.title = STATUS_LABELS[a.status];

  const info = document.createElement('div');
  info.className = 'info';

  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = a.title;
  info.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const badge = document.createElement('span');
  badge.className = 'status-badge st-' + a.status;
  badge.textContent = STATUS_LABELS[a.status];
  meta.appendChild(badge);
  if (a.date) {
    const dt = document.createElement('span');
    dt.className = 'date-tag';
    dt.textContent = formatDate(a.date);
    meta.appendChild(dt);
  }
  if (a.description) {
    const note = document.createElement('span');
    note.className = 'note';
    note.textContent = a.description;
    meta.appendChild(note);
  }
  info.appendChild(meta);

  const controls = document.createElement('div');
  controls.className = 'controls';

  const sel = document.createElement('select');
  sel.className = 'status-select';
  sel.title = 'Cambiar estado';
  STATUS_ORDER.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = STATUS_LABELS[s];
    if (s === a.status) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => updateActivity(a.id, { status: sel.value }));

  const dateBtn = document.createElement('button');
  dateBtn.className = 'icon-btn';
  dateBtn.title = a.date ? 'Cambiar fecha' : 'Asignar fecha';
  dateBtn.textContent = '📅';
  dateBtn.addEventListener('click', () => editDate(a));

  const del = document.createElement('button');
  del.className = 'icon-btn danger';
  del.title = 'Eliminar';
  del.textContent = '🗑';
  del.addEventListener('click', () => deleteActivity(a.id));

  controls.appendChild(sel);
  controls.appendChild(dateBtn);
  controls.appendChild(del);

  row.appendChild(marker);
  row.appendChild(info);
  row.appendChild(controls);
  li.appendChild(row);
  return li;
}

function editDate(a) {
  const current = a.date || '';
  const input = prompt('Fecha de la actividad (AAAA-MM-DD). Déjalo vacío para quitarla:', current);
  if (input === null) return; // canceló
  const val = input.trim();
  if (val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    alert('Formato no válido. Usa AAAA-MM-DD, por ejemplo 2026-08-15.');
    return;
  }
  updateActivity(a.id, { date: val || null });
}

function renderList() {
  const list = $('activity-list');
  const empty = $('activities-empty');
  list.innerHTML = '';

  $('activity-count').textContent = activities.length;

  let items = activities.slice();
  if (currentFilter !== 'todas') items = items.filter((a) => a.status === currentFilter);

  // Orden: las que tienen fecha primero (por fecha), luego las sin fecha.
  items.sort((a, b) => {
    if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  if (!items.length) {
    empty.hidden = false;
    empty.textContent = activities.length
      ? 'No hay actividades con este estado.'
      : 'Aún no hay actividades. ¡Agrega la primera! 💐';
    return;
  }
  empty.hidden = true;
  items.forEach((a) => list.appendChild(activityItemEl(a)));
}

// Filtros
$('filter-chips').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  document.querySelectorAll('#filter-chips .chip').forEach((c) => c.classList.toggle('active', c === btn));
  renderList();
});

// ---------- Render: calendario ----------
function activitiesByDate() {
  const map = {};
  activities.forEach((a) => {
    if (!a.date) return;
    (map[a.date] = map[a.date] || []).push(a);
  });
  return map;
}

function renderCalendar() {
  const grid = $('cal-grid');
  const title = $('cal-title');
  grid.innerHTML = '';

  title.textContent = `${MONTHS[calMonth]} ${calYear}`;
  const byDate = activitiesByDate();

  // Primer día del mes; semana empieza en lunes (0=lun ... 6=dom)
  const first = new Date(calYear, calMonth, 1);
  let startOffset = first.getDay() - 1;          // getDay: 0=dom
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayIso();

  for (let i = 0; i < startOffset; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    grid.appendChild(cell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoFromParts(calYear, calMonth, d);
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (iso === today) cell.classList.add('today');
    if (iso === selectedDay) cell.classList.add('selected');

    const num = document.createElement('span');
    num.className = 'daynum';
    num.textContent = d;
    cell.appendChild(num);

    const dayItems = byDate[iso] || [];
    if (dayItems.length) {
      cell.classList.add('has-items');
      const dots = document.createElement('div');
      dots.className = 'dots';
      // un punto por actividad (máx 4 para no saturar)
      dayItems.slice(0, 4).forEach((a) => {
        const dot = document.createElement('span');
        dot.className = 'dot st-' + a.status;
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
      cell.title = `${dayItems.length} actividad(es)`;
      cell.addEventListener('click', () => selectDay(iso));
    }

    grid.appendChild(cell);
  }

  // Si el día seleccionado ya no está en este mes, oculta el detalle.
  if (selectedDay) renderDayDetail();
}

function selectDay(iso) {
  selectedDay = (selectedDay === iso) ? null : iso;
  renderCalendar();
}

function renderDayDetail() {
  const box = $('cal-day-detail');
  const list = $('cal-day-list');
  const title = $('cal-day-title');
  if (!selectedDay) { box.hidden = true; return; }

  const items = (activitiesByDate()[selectedDay] || [])
    .slice()
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  if (!items.length) { box.hidden = true; return; }

  box.hidden = false;
  title.textContent = formatDate(selectedDay);
  list.innerHTML = '';
  items.forEach((a) => list.appendChild(activityItemEl(a)));
}

$('cal-prev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
$('cal-next').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

// ---------- Pestañas de vista ----------
function switchView(view) {
  const isList = view === 'list';
  $('tab-list').classList.toggle('active', isList);
  $('tab-calendar').classList.toggle('active', !isList);
  $('tab-list').setAttribute('aria-selected', String(isList));
  $('tab-calendar').setAttribute('aria-selected', String(!isList));
  $('view-list').hidden = !isList;
  $('view-calendar').hidden = isList;
}
$('tab-list').addEventListener('click', () => switchView('list'));
$('tab-calendar').addEventListener('click', () => switchView('calendar'));

// ---------- Init ----------
(function init() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  renderSuggestions();
  loadActivities();
})();
