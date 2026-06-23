// ===== Capa de almacenamiento =====
// Usa Supabase si están definidas las variables de entorno SUPABASE_URL y
// SUPABASE_KEY (en producción). Si no, usa un archivo JSON local (en tu PC).
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

// ---------------------------------------------------------------------------
//  Backend de ARCHIVOS (local)
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ACTIVITIES_FILE)) fs.writeFileSync(ACTIVITIES_FILE, '[]', 'utf8');
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return []; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

let counter = Date.now();
function nextId() { counter += 1; return counter.toString(36); }

const fileBackend = {
  async getActivities() {
    return readJson(ACTIVITIES_FILE);
  },
  async addActivity(activity) {
    const list = readJson(ACTIVITIES_FILE);
    const full = { id: nextId(), ...activity };
    list.push(full);
    writeJson(ACTIVITIES_FILE, list);
    return full;
  },
  async updateActivity(id, changes) {
    const list = readJson(ACTIVITIES_FILE);
    const a = list.find((x) => String(x.id) === String(id));
    if (!a) return null;
    Object.assign(a, changes);
    writeJson(ACTIVITIES_FILE, list);
    return a;
  },
  async deleteActivity(id) {
    const list = readJson(ACTIVITIES_FILE);
    const idx = list.findIndex((x) => String(x.id) === String(id));
    if (idx === -1) return false;
    list.splice(idx, 1);
    writeJson(ACTIVITIES_FILE, list);
    return true;
  },
};

// ---------------------------------------------------------------------------
//  Backend de SUPABASE (producción)
// ---------------------------------------------------------------------------
function supabaseRequest(method, pathAndQuery, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1' + pathAndQuery);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      timeout: 8000,
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(data ? JSON.parse(data) : null); }
          catch (e) { resolve(null); }
        } else {
          reject(new Error('Supabase ' + res.statusCode + ': ' + data));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Supabase timeout')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Mapeo: fila de Supabase -> forma que usa el frontend
function rowToActivity(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    date: r.due_date || null,
    status: r.status || 'pendiente',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const supabaseBackend = {
  async getActivities() {
    const rows = await supabaseRequest('GET', '/activities?select=*&order=created_at.asc');
    return (rows || []).map(rowToActivity);
  },
  async addActivity(activity) {
    const rows = await supabaseRequest('POST', '/activities', [{
      title: activity.title,
      description: activity.description,
      due_date: activity.date,
      status: activity.status,
      created_at: activity.createdAt,
      updated_at: activity.updatedAt,
    }]);
    return rowToActivity(rows[0]);
  },
  async updateActivity(id, changes) {
    const patch = {};
    if ('title' in changes) patch.title = changes.title;
    if ('description' in changes) patch.description = changes.description;
    if ('date' in changes) patch.due_date = changes.date;
    if ('status' in changes) patch.status = changes.status;
    if ('updatedAt' in changes) patch.updated_at = changes.updatedAt;
    const rows = await supabaseRequest(
      'PATCH',
      '/activities?id=eq.' + encodeURIComponent(id),
      patch
    );
    return rows && rows[0] ? rowToActivity(rows[0]) : null;
  },
  async deleteActivity(id) {
    await supabaseRequest('DELETE', '/activities?id=eq.' + encodeURIComponent(id));
    return true;
  },
};

// ---------------------------------------------------------------------------
if (!USE_SUPABASE) ensureData();

const backend = USE_SUPABASE ? supabaseBackend : fileBackend;

module.exports = {
  backend,
  usingSupabase: USE_SUPABASE,
};
