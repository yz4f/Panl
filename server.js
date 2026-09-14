import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-now';
const COOKIE_SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(32).toString('hex');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'analytics.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    ip_masked TEXT,
    page TEXT,
    referrer TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(compression());
app.use(express.json({ limit: '32kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 180 }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d', etag: true }));

function getIp(req) {
  const raw = (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();
  return raw.replace(/^::ffff:/, '');
}
function maskIp(ip) {
  if (!ip) return 'غير معروف';
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + ':****';
  const p = ip.split('.');
  if (p.length === 4) return `${p[0]}.${p[1]}.${p[2]}.***`;
  return ip;
}
function sign(value) {
  return crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('hex');
}
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('='); return [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))];
  }));
}
function isAdmin(req) {
  const c = parseCookies(req).ht_admin;
  if (!c) return false;
  const [ts, sig] = c.split('.');
  if (!ts || !sig || Number(ts) < Date.now() - 1000 * 60 * 60 * 12) return false;
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(ts))); } catch { return false; }
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}

app.post('/api/track', (req, res) => {
  const ip = getIp(req);
  const page = String(req.body?.page || '/').slice(0, 200);
  const referrer = String(req.body?.referrer || '').slice(0, 500);
  const ua = String(req.headers['user-agent'] || '').slice(0, 700);
  db.prepare('INSERT INTO visits (ip, ip_masked, page, referrer, user_agent) VALUES (?, ?, ?, ?, ?)')
    .run(ip, maskIp(ip), page, referrer, ua);
  res.json({ ok: true });
});

app.post('/api/admin/login', (req, res) => {
  const pass = String(req.body?.password || '');
  const a = Buffer.from(pass);
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ ok: false });
  const ts = String(Date.now());
  const token = `${ts}.${sign(ts)}`;
  res.setHeader('Set-Cookie', `ht_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'ht_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const total = db.prepare('SELECT COUNT(*) c FROM visits').get().c;
  const today = db.prepare("SELECT COUNT(*) c FROM visits WHERE date(created_at)=date('now')").get().c;
  const uniqueToday = db.prepare("SELECT COUNT(DISTINCT ip) c FROM visits WHERE date(created_at)=date('now')").get().c;
  const pages = db.prepare('SELECT page, COUNT(*) c FROM visits GROUP BY page ORDER BY c DESC LIMIT 8').all();
  const recent = db.prepare('SELECT id, ip, ip_masked, page, referrer, user_agent, created_at FROM visits ORDER BY id DESC LIMIT 100').all();
  const daily = db.prepare("SELECT date(created_at) d, COUNT(*) c FROM visits WHERE created_at >= datetime('now','-13 days') GROUP BY date(created_at) ORDER BY d").all();
  res.json({ total, today, uniqueToday, pages, recent, daily, privacy: 'IPs are displayed masked by default.' });
});

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`هلس تبوك يعمل على المنفذ ${PORT}`));
