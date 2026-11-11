const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const busboy = require('busboy');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'arte';
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(__dirname, 'data'));
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const ENTRIES_FILE = path.join(DATA_DIR, 'entries.json');
const MAX_FILE_SIZE = 80 * 1024 * 1024;
const MAX_TEXT_BODY = 20000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function ensureDataDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(ENTRIES_FILE)) {
    const seed = [{
      id: crypto.randomUUID(),
      date: '16 ago 2026',
      medium: 'Mapa conceptual',
      title: "Intermedia — Santiago punto cero 0'0",
      note: "Diagrama de investigación que cruza arte, territorio y espacio urbano: performance, intervención, vida cotidiana y protesta en el Santiago punto cero, en diálogo con la escena LATAM.",
      items: [{ id: crypto.randomUUID(), type: 'imagen', fileUrl: './Intermedia.jpeg', fileName: 'Intermedia.jpeg', body: null }],
    }];
    fs.writeFileSync(ENTRIES_FILE, JSON.stringify(seed, null, 2));
  }
}

function readEntries() {
  try {
    return JSON.parse(fs.readFileSync(ENTRIES_FILE, 'utf8')).map(normalizeEntry);
  } catch {
    return [];
  }
}

function writeEntriesAtomic(entries) {
  const tmp = ENTRIES_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2));
  fs.renameSync(tmp, ENTRIES_FILE);
}

function checkAuth(req) {
  const given = req.headers['x-admin-password'];
  return typeof given === 'string' && given === ADMIN_PASSWORD;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const MAX_FILES = 30;

function inferType(mimeType, filename) {
  const ext = path.extname(filename || '').toLowerCase();
  if ((mimeType || '').startsWith('video/') || ['.mp4', '.webm', '.mov', '.m4v'].includes(ext)) return 'video';
  if ((mimeType || '').startsWith('text/') || ['.txt', '.md'].includes(ext)) return 'texto';
  return 'imagen';
}

function uploadPath(fileUrl) {
  return path.join(UPLOADS_DIR, fileUrl.slice('/uploads/'.length));
}

function deleteItemFile(item) {
  if (item && item.fileUrl && item.fileUrl.startsWith('/uploads/')) {
    fs.unlink(uploadPath(item.fileUrl), () => {});
  }
}

// Legacy entries had a single file (type/fileUrl/fileName/body at the top level).
// Convert them to the multi-item shape: entry.items = [{ id, type, fileUrl, fileName, body }].
function normalizeEntry(e) {
  if (Array.isArray(e.items)) return e;
  const items = [];
  if (e.fileUrl || e.body) {
    items.push({ id: crypto.randomUUID(), type: e.type || 'imagen', fileUrl: e.fileUrl || null, fileName: e.fileName || null, body: e.body || null });
  }
  const { type, fileUrl, fileName, body, ...rest } = e;
  return { ...rest, items };
}

function parseMultipart(req, cb) {
  let bb;
  try {
    bb = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES } });
  } catch (e) {
    cb(e);
    return;
  }
  const fields = {};
  const files = [];
  const writes = [];
  let fileTooLarge = false;

  bb.on('field', (name, val) => {
    fields[name] = val;
  });

  bb.on('file', (name, stream, info) => {
    if (!info.filename) {
      stream.resume();
      return;
    }
    const id = crypto.randomUUID();
    const safeName = info.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
    const storedName = id + '-' + safeName;
    const dest = path.join(UPLOADS_DIR, storedName);
    files.push({ storedName, originalName: info.filename, mimeType: info.mimeType, dest });
    const writeStream = fs.createWriteStream(dest);
    stream.on('limit', () => {
      fileTooLarge = true;
    });
    writes.push(new Promise((resolve) => {
      writeStream.on('close', resolve);
      writeStream.on('error', resolve);
    }));
    stream.pipe(writeStream);
  });

  bb.on('finish', () => {
    Promise.all(writes).then(() => {
      if (fileTooLarge) {
        files.forEach((f) => fs.unlink(f.dest, () => {}));
        cb(new Error('Un archivo supera el tamaño máximo permitido (80 MB).'));
        return;
      }
      cb(null, { fields, files });
    });
  });
  bb.on('error', (err) => cb(err));
  req.pipe(bb);
}

function filesToItems(files) {
  return files.map((f) => {
    const type = inferType(f.mimeType, f.originalName);
    let body = null;
    if (type === 'texto') {
      try {
        body = fs.readFileSync(f.dest, 'utf8').slice(0, MAX_TEXT_BODY);
      } catch {}
    }
    return { id: crypto.randomUUID(), type, fileUrl: '/uploads/' + f.storedName, fileName: f.originalName, body };
  });
}

function handleCreate({ fields, files }, res) {
  if (!(fields.title || '').trim() && files.length === 0) {
    return sendJson(res, 400, { error: 'Agrega un título o al menos un archivo.' });
  }
  const entries = readEntries();
  const entry = {
    id: crypto.randomUUID(),
    title: fields.title || '',
    date: fields.date || '',
    medium: fields.medium || '',
    note: fields.note || '',
    items: filesToItems(files),
  };
  entries.push(entry);
  writeEntriesAtomic(entries);
  sendJson(res, 201, entry);
}

function handleUpdate(id, { fields, files }, res) {
  const entries = readEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) {
    files.forEach((f) => fs.unlink(f.dest, () => {}));
    return sendJson(res, 404, { error: 'not found' });
  }
  const entry = entries[idx];
  entry.title = fields.title ?? entry.title;
  entry.date = fields.date ?? entry.date;
  entry.medium = fields.medium ?? entry.medium;
  entry.note = fields.note ?? entry.note;
  let removeIds = [];
  try {
    removeIds = JSON.parse(fields.removeItems || '[]');
  } catch {}
  if (Array.isArray(removeIds) && removeIds.length) {
    entry.items.filter((it) => removeIds.includes(it.id)).forEach(deleteItemFile);
    entry.items = entry.items.filter((it) => !removeIds.includes(it.id));
  }
  entry.items = entry.items.concat(filesToItems(files));
  entries[idx] = entry;
  writeEntriesAtomic(entries);
  sendJson(res, 200, entry);
}

function handleDelete(id, res) {
  const entries = readEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return sendJson(res, 404, { error: 'not found' });
  const [removed] = entries.splice(idx, 1);
  writeEntriesAtomic(entries);
  (removed.items || []).forEach(deleteItemFile);
  sendJson(res, 200, { ok: true });
}

function serveStatic(pathname, res) {
  let urlPath = pathname === '/' ? '/index.html' : pathname;
  let filePath;
  if (urlPath.startsWith('/uploads/')) {
    filePath = path.join(UPLOADS_DIR, urlPath.slice('/uploads/'.length));
    if (!filePath.startsWith(UPLOADS_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
  } else {
    filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://internal');
  const pathname = decodeURIComponent(u.pathname);

  if (pathname === '/api/entries' && req.method === 'GET') {
    return sendJson(res, 200, readEntries());
  }

  if (pathname === '/api/entries' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'unauthorized' });
    return parseMultipart(req, (err, result) => {
      if (err) return sendJson(res, 400, { error: err.message });
      handleCreate(result, res);
    });
  }

  const editMatch = pathname.match(/^\/api\/entries\/([a-zA-Z0-9-]+)$/);
  if (editMatch && req.method === 'PUT') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'unauthorized' });
    return parseMultipart(req, (err, result) => {
      if (err) return sendJson(res, 400, { error: err.message });
      handleUpdate(editMatch[1], result, res);
    });
  }
  if (editMatch && req.method === 'DELETE') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'unauthorized' });
    return handleDelete(editMatch[1], res);
  }

  serveStatic(pathname, res);
});

ensureDataDir();
// One-time migration of legacy single-file entries so item ids are stable on disk.
try {
  const raw = JSON.parse(fs.readFileSync(ENTRIES_FILE, 'utf8'));
  if (raw.some((e) => !Array.isArray(e.items))) writeEntriesAtomic(raw.map(normalizeEntry));
} catch {}
server.listen(PORT, () => console.log('Bitácora de Arte listening on port ' + PORT + ' (data: ' + DATA_DIR + ')'));
