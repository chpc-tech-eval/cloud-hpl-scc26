import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const startedAt = Date.now();
let requests = 0;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      project_slug TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      team_id INT REFERENCES teams(id),
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );`);
  await pool.query(
    `INSERT INTO teams (name, project_slug) VALUES ($1, $2)
     ON CONFLICT (project_slug) DO UPDATE SET name = EXCLUDED.name`,
    [process.env.TEAM_NAME || 'My Team', process.env.TEAM_SLUG || 'my-team']
  );
}

const app = express();
app.set('trust proxy', 1); // behind Traefik
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use((req, res, next) => { requests++; next(); });

// ---- health / telemetry (no auth, no secrets) ----
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/ready', wrap(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ready' });
}));
app.get('/metrics', (req, res) => {
  res.type('text/plain').send(
    `# TYPE student_platform_requests_total counter\nstudent_platform_requests_total ${requests}\n` +
    `# TYPE student_platform_uptime_seconds gauge\nstudent_platform_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}\n`
  );
});

// ---- auth ----
async function currentUser(req) {
  const t = req.cookies.sid;
  if (!t) return null;
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.display_name, t.name AS team_name, t.project_slug
       FROM sessions s JOIN users u ON u.id = s.user_id
       LEFT JOIN teams t ON t.id = u.team_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha(t)]);
  return rows[0] || null;
}
const requireAuth = wrap(async (req, res, next) => {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not authenticated' });
  req.user = u; next();
});

app.post('/api/register', wrap(async (req, res) => {
  const { username, displayName, password, code } = req.body || {};
  if (!process.env.REGISTRATION_CODE || code !== process.env.REGISTRATION_CODE)
    return res.status(403).json({ error: 'invalid registration code' });
  if (!/^[a-zA-Z0-9_.@-]{3,64}$/.test(username || '') || !displayName || (password || '').length < 12)
    return res.status(400).json({ error: 'username 3-64 chars, display name required, password >= 12 chars' });
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (username, display_name, password_hash, team_id)
       VALUES ($1, $2, $3, (SELECT id FROM teams WHERE project_slug = $4))
       RETURNING id`,
      [username, displayName, hash, process.env.TEAM_SLUG || 'my-team']);
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'username taken' });
    throw e;
  }
}));

app.post('/api/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE username = $1', [username || '']);
  const ok = rows[0] && await bcrypt.compare(password || '', rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '8 hours')`,
    [sha(token), rows[0].id]);
  res.cookie('sid', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 8 * 3600 * 1000, path: '/' });
  res.json({ ok: true });
}));

app.post('/api/logout', wrap(async (req, res) => {
  if (req.cookies.sid) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha(req.cookies.sid)]);
  res.clearCookie('sid', { path: '/' });
  res.json({ ok: true });
}));

app.get('/api/me', requireAuth, (req, res) => res.json(req.user));

// Safe status view: no cluster credentials, only what the backend itself knows.
app.get('/api/status', requireAuth, wrap(async (req, res) => {
  const t0 = Date.now();
  const { rows } = await pool.query('SELECT count(*)::int AS users FROM users');
  res.json({
    backend: 'ok',
    database: 'ok',
    db_latency_ms: Date.now() - t0,
    registered_users: rows[0].users,
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    image_revision: process.env.GIT_SHA || 'unknown',
    server_time_utc: new Date().toISOString()
  });
}));

// ---- static Astro frontend ----
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

// retry DB connection at start so the pod survives Postgres starting later
for (let i = 0; i < 30; i++) {
  try { await initDb(); break; }
  catch (e) { console.error('DB not ready, retrying...', e.message); await new Promise(r => setTimeout(r, 2000)); }
}
app.listen(8080, () => console.log('listening on 8080'));