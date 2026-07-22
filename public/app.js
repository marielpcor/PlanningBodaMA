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
const VIEW_TABS = { list: 'tab-list', calendar: 'tab-calendar', mesas: 'tab-mesas' };
const VIEW_SECTIONS = { list: 'view-list', calendar: 'view-calendar', mesas: 'view-mesas' };
function switchView(view) {
  Object.keys(VIEW_TABS).forEach((v) => {
    const on = v === view;
    $(VIEW_TABS[v]).classList.toggle('active', on);
    $(VIEW_TABS[v]).setAttribute('aria-selected', String(on));
    $(VIEW_SECTIONS[v]).hidden = !on;
  });
  // El formulario "Nueva actividad" solo aplica a la vista de lista.
  $('agregar').hidden = view !== 'list';
}
$('tab-list').addEventListener('click', () => switchView('list'));
$('tab-calendar').addEventListener('click', () => switchView('calendar'));
$('tab-mesas').addEventListener('click', () => switchView('mesas'));

// ========================================================================
//  MESAS (croquis interactivo)
// ========================================================================
let tables = [];
let currentTableId = null;   // mesa abierta en el modal

async function loadTables() {
  try {
    const data = await api('/api/tables');
    tables = data.tables || [];
  } catch (e) {
    tables = [];
  }
  renderPlano();
}

// ----- Selector de forma (pastillas) -----
function setShape(pickerId, hiddenId, shape) {
  if (hiddenId) $(hiddenId).value = shape;
  document.querySelectorAll('#' + pickerId + ' .shape-opt').forEach((o) => {
    const on = o.dataset.shape === shape;
    o.classList.toggle('active', on);
    o.setAttribute('aria-checked', String(on));
  });
}
$('t-shape-picker').addEventListener('click', (e) => {
  const opt = e.target.closest('.shape-opt');
  if (opt) setShape('t-shape-picker', 't-shape', opt.dataset.shape);
});

// ----- Agregar mesa -----
$('table-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('table-msg');
  const name = $('t-name').value.trim();
  if (!name) { showMsg(msg, 'Escribe el nombre de la mesa.', 'err'); return; }
  const btn = $('t-add-btn');
  btn.disabled = true;

  // Posición inicial escalonada para que no se encimen.
  const n = tables.length;
  const x = 16 + (n % 4) * 22;
  const y = Math.min(16 + Math.floor(n / 4) * 26, 88);

  try {
    const { table } = await api('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        shape: $('t-shape').value,
        capacity: $('t-cap').value === '' ? null : $('t-cap').value,
        x, y,
        guests: [],
      }),
    });
    tables.push(table);
    $('t-name').value = '';
    $('t-cap').value = '';
    setShape('t-shape-picker', 't-shape', 'round');
    showMsg(msg, '¡Mesa agregada! 🪑', 'ok');
    renderPlano();
  } catch (err) {
    showMsg(msg, err.message, 'err');
  } finally {
    btn.disabled = false;
  }
});

// ----- Invitados (nombre + estado) -----
// Compatibilidad: un invitado puede ser un string (antiguo) o un objeto.
function gName(g) { return typeof g === 'string' ? g : (g && g.name) || ''; }
function gStatus(g) { return typeof g === 'string' ? 'pendiente' : ((g && g.status) || 'pendiente'); }
function confirmedCount(t) {
  return (t.guests || []).filter((g) => gStatus(g) === 'confirmado').length;
}

// ----- Render del plano -----
function tableCountText(t) {
  const g = t.guests ? t.guests.length : 0;
  return t.capacity ? `${g}/${t.capacity}` : `${g}`;
}
function isOver(t) {
  return t.capacity != null && t.guests && t.guests.length > t.capacity;
}

function renderPlano() {
  const plano = $('plano');
  $('table-count').textContent = tables.length;

  const totalGuests = tables.reduce((s, t) => s + (t.guests ? t.guests.length : 0), 0);
  const totalConfirmed = tables.reduce((s, t) => s + confirmedCount(t), 0);
  $('plano-total').textContent = tables.length
    ? `${tables.length} mesa(s) · ${totalGuests} invitado(s) · ✓ ${totalConfirmed} confirmado(s) · ○ ${totalGuests - totalConfirmed} pendiente(s)`
    : '';

  plano.querySelectorAll('.table-node').forEach((node) => node.remove());
  $('tables-empty').hidden = tables.length > 0;
  tables.forEach((t) => plano.appendChild(tableNodeEl(t)));

  // Reaplica el resaltado de búsqueda tras redibujar.
  applySearchHighlight();
}

function tableNodeEl(t) {
  const node = document.createElement('div');
  node.className = 'table-node shape-' + t.shape + (isOver(t) ? ' over' : '');
  node.style.left = t.x + '%';
  node.style.top = t.y + '%';
  node.dataset.id = t.id;

  const shape = document.createElement('div');
  shape.className = 'table-shape';
  const nm = document.createElement('span');
  nm.className = 't-name';
  nm.textContent = t.name;
  const cnt = document.createElement('span');
  cnt.className = 't-count';
  cnt.textContent = tableCountText(t);
  shape.appendChild(nm);
  shape.appendChild(cnt);
  node.appendChild(shape);

  const guests = t.guests || [];
  if (guests.length) {
    const ul = document.createElement('ul');
    ul.className = 't-guests';
    guests.slice(0, 8).forEach((g) => {
      const li = document.createElement('li');
      li.className = 'g-' + gStatus(g);
      li.textContent = (gStatus(g) === 'confirmado' ? '✓ ' : '○ ') + gName(g);
      ul.appendChild(li);
    });
    if (guests.length > 8) {
      const li = document.createElement('li');
      li.className = 'more';
      li.textContent = `+${guests.length - 8} más`;
      ul.appendChild(li);
    }
    node.appendChild(ul);
  }

  attachDrag(node, t);
  return node;
}

// ----- Arrastrar mesas (y distinguir clic para abrir el modal) -----
function attachDrag(node, t) {
  let startX, startY, origX, origY, moved, rect;

  function onMove(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    moved = true;
    let nx = origX + (dx / rect.width) * 100;
    let ny = origY + (dy / rect.height) * 100;
    nx = Math.max(2, Math.min(98, nx));
    ny = Math.max(3, Math.min(97, ny));
    t.x = nx; t.y = ny;
    node.style.left = nx + '%';
    node.style.top = ny + '%';
  }

  async function onUp(e) {
    node.classList.remove('dragging');
    node.removeEventListener('pointermove', onMove);
    node.removeEventListener('pointerup', onUp);
    try { node.releasePointerCapture(e.pointerId); } catch (_) {}
    if (moved) {
      try {
        await api('/api/tables/' + encodeURIComponent(t.id), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: t.x, y: t.y }),
        });
      } catch (_) { /* la posición ya está en memoria */ }
    } else {
      openTableModal(t.id);
    }
  }

  node.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    rect = $('plano').getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    origX = t.x; origY = t.y;
    moved = false;
    node.classList.add('dragging');
    try { node.setPointerCapture(e.pointerId); } catch (_) {}
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', onUp);
  });
}

// ----- Modal: editar mesa e invitados -----
function currentTable() {
  return tables.find((t) => String(t.id) === String(currentTableId)) || null;
}

function openTableModal(id) {
  currentTableId = id;
  const t = currentTable();
  if (!t) return;
  $('modal-title').textContent = t.name;
  $('m-name').value = t.name;
  $('m-cap').value = t.capacity == null ? '' : t.capacity;
  setShape('m-shape-picker', null, t.shape);
  renderGuestList();
  $('table-modal').hidden = false;
  $('m-guest-input').focus();
}

function closeTableModal() {
  $('table-modal').hidden = true;
  currentTableId = null;
}

function renderGuestList() {
  const t = currentTable();
  if (!t) return;
  const list = $('m-guest-list');
  const guests = t.guests || [];
  const counter = $('m-guest-counter');

  $('m-guests-empty').hidden = guests.length > 0;
  const conf = confirmedCount(t);
  const base = t.capacity ? `${guests.length}/${t.capacity}` : `${guests.length} invitado(s)`;
  counter.textContent = guests.length ? `${base} · ✓ ${conf} confirmado(s)` : base;
  counter.classList.toggle('over', isOver(t));

  const others = tables.filter((x) => String(x.id) !== String(t.id));

  list.innerHTML = '';
  guests.forEach((g, i) => {
    const status = gStatus(g);
    const li = document.createElement('li');
    li.className = 'guest-item';
    const num = document.createElement('span'); num.className = 'g-num'; num.textContent = i + 1;
    const nm = document.createElement('span'); nm.className = 'g-name'; nm.textContent = gName(g);

    li.appendChild(num);
    li.appendChild(nm);

    // Alternar Confirmado / Pendiente
    const st = document.createElement('button');
    st.type = 'button';
    st.className = 'guest-status ' + status;
    st.textContent = status === 'confirmado' ? '✓ Confirmado' : '○ Pendiente';
    st.title = 'Cambiar a ' + (status === 'confirmado' ? 'pendiente' : 'confirmado');
    st.addEventListener('click', () => toggleGuestStatus(i));
    li.appendChild(st);

    // Mover a otra mesa
    if (others.length) {
      const mv = document.createElement('select');
      mv.className = 'move-select';
      mv.title = 'Mover a otra mesa';
      const def = document.createElement('option');
      def.value = ''; def.textContent = 'Mover a…'; def.disabled = true; def.selected = true;
      mv.appendChild(def);
      others.forEach((o) => {
        const op = document.createElement('option');
        op.value = o.id;
        op.textContent = o.name;
        mv.appendChild(op);
      });
      mv.addEventListener('change', () => { if (mv.value) moveGuest(i, mv.value); });
      li.appendChild(mv);
    }

    const rm = document.createElement('button');
    rm.className = 'icon-btn danger'; rm.textContent = '✕'; rm.title = 'Quitar invitado';
    rm.addEventListener('click', () => removeGuest(i));
    li.appendChild(rm);

    list.appendChild(li);
  });
}

// Mueve un invitado de la mesa actual a la mesa destino.
async function moveGuest(index, targetId) {
  const t = currentTable();
  if (!t) return;
  const target = tables.find((x) => String(x.id) === String(targetId));
  if (!target) return;
  const guest = (t.guests || [])[index];
  if (guest == null) return;

  const srcGuests = (t.guests || []).slice();
  srcGuests.splice(index, 1);
  const dstGuests = (target.guests || []).concat(guest);

  // Actualiza la mesa destino…
  try {
    const { table } = await api('/api/tables/' + encodeURIComponent(target.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guests: dstGuests }),
    });
    const i = tables.findIndex((x) => String(x.id) === String(target.id));
    if (i !== -1) tables[i] = table;
  } catch (e) { return; }

  // …y la mesa actual (esto ya re-renderiza el plano).
  await saveTable({ guests: srcGuests });
  renderGuestList();
}

async function saveTable(changes) {
  const t = currentTable();
  if (!t) return null;
  try {
    const { table } = await api('/api/tables/' + encodeURIComponent(t.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    const i = tables.findIndex((x) => String(x.id) === String(t.id));
    if (i !== -1) tables[i] = table;
    renderPlano();
    return table;
  } catch (e) {
    return null;
  }
}

async function addGuest() {
  const input = $('m-guest-input');
  const name = input.value.trim();
  if (!name) return;
  const t = currentTable();
  if (!t) return;
  const guests = (t.guests || []).concat({ name, status: 'pendiente' });
  input.value = '';
  input.focus();
  if (await saveTable({ guests })) renderGuestList();
}

// Alterna el estado de un invitado entre confirmado y pendiente.
async function toggleGuestStatus(index) {
  const t = currentTable();
  if (!t) return;
  const guests = (t.guests || []).map((g) => ({ name: gName(g), status: gStatus(g) }));
  if (!guests[index]) return;
  guests[index].status = guests[index].status === 'confirmado' ? 'pendiente' : 'confirmado';
  if (await saveTable({ guests })) renderGuestList();
}

async function removeGuest(index) {
  const t = currentTable();
  if (!t) return;
  const guests = (t.guests || []).slice();
  guests.splice(index, 1);
  if (await saveTable({ guests })) renderGuestList();
}

$('m-guest-add').addEventListener('click', addGuest);
$('m-guest-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addGuest(); }
});
$('m-shape-picker').addEventListener('click', (e) => {
  const opt = e.target.closest('.shape-opt');
  if (!opt) return;
  setShape('m-shape-picker', null, opt.dataset.shape);
  saveTable({ shape: opt.dataset.shape });
});
$('m-name').addEventListener('change', () => {
  const v = $('m-name').value.trim();
  const t = currentTable();
  if (!t) return;
  if (v) { saveTable({ name: v }); $('modal-title').textContent = v; }
  else { $('m-name').value = t.name; }
});
$('m-cap').addEventListener('change', () => {
  const raw = $('m-cap').value;
  saveTable({ capacity: raw === '' ? null : raw }).then(() => renderGuestList());
});
$('m-delete').addEventListener('click', async () => {
  const t = currentTable();
  if (!t) return;
  if (!confirm(`¿Eliminar "${t.name}" y sus invitados?`)) return;
  try {
    await api('/api/tables/' + encodeURIComponent(t.id), { method: 'DELETE' });
    tables = tables.filter((x) => String(x.id) !== String(t.id));
    closeTableModal();
    renderPlano();
  } catch (e) { /* noop */ }
});
$('m-done').addEventListener('click', closeTableModal);
$('modal-close').addEventListener('click', closeTableModal);
$('table-modal').addEventListener('click', (e) => {
  if (e.target === $('table-modal')) closeTableModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('table-modal').hidden) closeTableModal();
});

// ----- Buscar invitado -----
function applySearchHighlight() {
  const input = $('guest-search-input');
  if (!input) return;
  const q = input.value.trim().toLowerCase();
  const ids = new Set();
  if (q) {
    tables.forEach((t) => {
      if ((t.guests || []).some((g) => gName(g).toLowerCase().includes(q))) ids.add(String(t.id));
    });
  }
  document.querySelectorAll('#plano .table-node').forEach((n) => {
    n.classList.toggle('found', ids.has(n.dataset.id));
  });
}

function renderGuestSearch() {
  const q = $('guest-search-input').value.trim().toLowerCase();
  const box = $('guest-search-results');
  box.innerHTML = '';

  if (!q) { box.hidden = true; applySearchHighlight(); return; }

  const matches = [];
  tables.forEach((t) => {
    (t.guests || []).forEach((g) => {
      if (gName(g).toLowerCase().includes(q)) matches.push({ guest: g, table: t });
    });
  });

  box.hidden = false;
  if (!matches.length) {
    const li = document.createElement('li');
    li.className = 'no-match';
    li.textContent = 'Sin coincidencias';
    box.appendChild(li);
    applySearchHighlight();
    return;
  }

  matches.slice(0, 25).forEach((m) => {
    const li = document.createElement('li');
    li.className = 'search-result';
    const nm = document.createElement('span');
    nm.className = 'sr-name';
    nm.textContent = (gStatus(m.guest) === 'confirmado' ? '✓ ' : '○ ') + gName(m.guest);
    const tb = document.createElement('span'); tb.className = 'sr-table'; tb.textContent = '→ ' + m.table.name;
    li.appendChild(nm); li.appendChild(tb);
    li.addEventListener('click', () => openTableModal(m.table.id));
    box.appendChild(li);
  });
  applySearchHighlight();
}
$('guest-search-input').addEventListener('input', renderGuestSearch);

// ----- Exportar la lista por mesa -----
function exportList() {
  if (!tables.length) { alert('Aún no hay mesas que exportar.'); return; }
  const lines = ['Croquis de mesas — M & A', '========================', ''];
  let total = 0;
  let totalConf = 0;
  tables.forEach((t) => {
    const g = t.guests || [];
    const conf = confirmedCount(t);
    total += g.length;
    totalConf += conf;
    const cap = t.capacity ? `/${t.capacity}` : '';
    lines.push(`${t.name} (${g.length}${cap}) — ✓ ${conf} confirmado(s), ○ ${g.length - conf} pendiente(s)`);
    if (g.length) {
      g.forEach((guest, i) => {
        const mark = gStatus(guest) === 'confirmado' ? '[✓]' : '[ ]';
        lines.push(`  ${i + 1}. ${mark} ${gName(guest)}`);
      });
    } else {
      lines.push('  (sin invitados)');
    }
    lines.push('');
  });
  lines.push(`Total: ${tables.length} mesa(s) · ${total} invitado(s) · ✓ ${totalConf} confirmado(s) · ○ ${total - totalConf} pendiente(s)`);

  const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mesas-invitados-M-y-A.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('export-croquis').addEventListener('click', exportList);

$('print-croquis').addEventListener('click', () => window.print());

// ---------- Init ----------
(function init() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  renderSuggestions();
  loadActivities();
  loadTables();
})();
