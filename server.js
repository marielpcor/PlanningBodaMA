// ===== Planificador Boda M & A — servidor sin dependencias (solo Node nativo) =====
const http = require('http');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');
const { backend, usingSupabase } = require('./storage');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const STATUSES = ['pendiente', 'en_proceso', 'finalizado'];

// ---------- Helpers HTTP ----------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy(); // protección
    });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); }
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === '/') pathname = '/index.html';

  // Evita salir de la carpeta public
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); return res.end('Prohibido');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('No encontrado');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- Validación ----------
// Acepta fechas vacías (null) o en formato YYYY-MM-DD.
function normalizeDate(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function normalizeStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return STATUSES.includes(s) ? s : 'pendiente';
}

const SHAPES = ['round', 'rect'];
function normalizeShape(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return SHAPES.includes(s) ? s : 'round';
}
// Capacidad: entero >= 0, o null si no se indica.
function normalizeCapacity(raw) {
  if (raw == null || raw === '') return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.min(n, 100);
}
// Coordenada en porcentaje (0–100) dentro del plano.
function normalizeCoord(raw, fallback) {
  const n = Number(raw);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}
// Lista de invitados: cada uno es { name, status }.
// Acepta strings (compatibilidad) u objetos; normaliza a objeto.
const GUEST_STATUSES = ['confirmado', 'pendiente'];
function normalizeGuests(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => {
      if (g && typeof g === 'object') {
        const name = String(g.name || '').trim();
        const status = GUEST_STATUSES.includes(g.status) ? g.status : 'pendiente';
        return name ? { name: name.slice(0, 60), status } : null;
      }
      const name = String(g).trim();
      return name ? { name: name.slice(0, 60), status: 'pendiente' } : null;
    })
    .filter(Boolean)
    .slice(0, 60);
}

// ---------- Lógica de actividades ----------
async function createActivity(req, res) {
  const body = await readBody(req);
  const title = (body.title || '').trim();
  if (!title) return sendJson(res, 400, { error: 'Por favor escribe el nombre de la actividad.' });

  const now = new Date().toISOString();
  const activity = await backend.addActivity({
    title,
    description: (body.description || '').trim(),
    date: normalizeDate(body.date),
    status: normalizeStatus(body.status),
    createdAt: now,
    updatedAt: now,
  });
  sendJson(res, 200, { activity });
}

async function patchActivity(req, res, id) {
  const body = await readBody(req);
  const changes = {};
  if ('title' in body) {
    const t = (body.title || '').trim();
    if (!t) return sendJson(res, 400, { error: 'El nombre no puede quedar vacío.' });
    changes.title = t;
  }
  if ('description' in body) changes.description = (body.description || '').trim();
  if ('date' in body) changes.date = normalizeDate(body.date);
  if ('status' in body) changes.status = normalizeStatus(body.status);
  changes.updatedAt = new Date().toISOString();

  const activity = await backend.updateActivity(id, changes);
  if (!activity) return sendJson(res, 404, { error: 'Actividad no encontrada.' });
  sendJson(res, 200, { activity });
}

async function removeActivity(req, res, id) {
  const ok = await backend.deleteActivity(id);
  if (!ok) return sendJson(res, 404, { error: 'Actividad no encontrada.' });
  sendJson(res, 200, { ok: true });
}

// ---------- Lógica de mesas ----------
async function createTable(req, res) {
  const body = await readBody(req);
  const name = (body.name || '').trim();
  if (!name) return sendJson(res, 400, { error: 'Por favor escribe el nombre de la mesa.' });

  const now = new Date().toISOString();
  const table = await backend.addTable({
    name,
    shape: normalizeShape(body.shape),
    capacity: normalizeCapacity(body.capacity),
    x: normalizeCoord(body.x, 10),
    y: normalizeCoord(body.y, 10),
    guests: normalizeGuests(body.guests),
    createdAt: now,
    updatedAt: now,
  });
  sendJson(res, 200, { table });
}

async function patchTable(req, res, id) {
  const body = await readBody(req);
  const changes = {};
  if ('name' in body) {
    const n = (body.name || '').trim();
    if (!n) return sendJson(res, 400, { error: 'El nombre no puede quedar vacío.' });
    changes.name = n;
  }
  if ('shape' in body) changes.shape = normalizeShape(body.shape);
  if ('capacity' in body) changes.capacity = normalizeCapacity(body.capacity);
  if ('x' in body) changes.x = normalizeCoord(body.x, 10);
  if ('y' in body) changes.y = normalizeCoord(body.y, 10);
  if ('guests' in body) changes.guests = normalizeGuests(body.guests);
  changes.updatedAt = new Date().toISOString();

  const table = await backend.updateTable(id, changes);
  if (!table) return sendJson(res, 404, { error: 'Mesa no encontrada.' });
  sendJson(res, 200, { table });
}

async function removeTable(req, res, id) {
  const ok = await backend.deleteTable(id);
  if (!ok) return sendJson(res, 404, { error: 'Mesa no encontrada.' });
  sendJson(res, 200, { ok: true });
}

// ---------- Router ----------
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname;

  // /api/activities  ó  /api/activities/:id
  const match = pathname.match(/^\/api\/activities(?:\/([^/]+))?$/);
  if (match) {
    const id = match[1] ? decodeURIComponent(match[1]) : null;
    try {
      if (req.method === 'GET' && !id) {
        return sendJson(res, 200, { activities: await backend.getActivities() });
      }
      if (req.method === 'POST' && !id) {
        return await createActivity(req, res);
      }
      if (req.method === 'PATCH' && id) {
        return await patchActivity(req, res, id);
      }
      if (req.method === 'DELETE' && id) {
        return await removeActivity(req, res, id);
      }
    } catch (e) {
      return sendJson(res, 500, { error: 'Error en el servidor.' });
    }
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Método no permitido');
  }

  // /api/tables  ó  /api/tables/:id
  const tmatch = pathname.match(/^\/api\/tables(?:\/([^/]+))?$/);
  if (tmatch) {
    const id = tmatch[1] ? decodeURIComponent(tmatch[1]) : null;
    try {
      if (req.method === 'GET' && !id) {
        return sendJson(res, 200, { tables: await backend.getTables() });
      }
      if (req.method === 'POST' && !id) {
        return await createTable(req, res);
      }
      if (req.method === 'PATCH' && id) {
        return await patchTable(req, res, id);
      }
      if (req.method === 'DELETE' && id) {
        return await removeTable(req, res, id);
      }
    } catch (e) {
      return sendJson(res, 500, { error: 'Error en el servidor.' });
    }
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Método no permitido');
  }

  if (req.method === 'GET') return serveStatic(req, res);

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Método no permitido');
});

server.listen(PORT, () => {
  console.log(`\n  💍  Planificador Boda M & A`);
  console.log(`  Almacenamiento: ${usingSupabase ? 'Supabase (nube)' : 'archivos locales (data/)'}`);
  console.log(`  Servidor corriendo en: http://localhost:${PORT}\n`);
});
