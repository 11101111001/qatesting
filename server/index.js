// server/index.js

/*
    
*/
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'tests');
const PUBLIC_DIR = path.join(ROOT, 'public');

// ---------- Credentials (saved or ephemeral token) ----------
const state = { hnUser: null, hnPass: null };

const credsStore = new Map(); // token -> { user, pass, expiresAt }
const newToken = () => crypto.randomBytes(16).toString('hex');
function setCreds(user, pass) {
  const token = newToken();
  credsStore.set(token, { user, pass, expiresAt: Date.now() + 15 * 60_000 }); // 15 min
  return token;
}
function getCreds(token) {
  const rec = credsStore.get(token);
  if (!rec) return null;
  if (Date.now() > rec.expiresAt) {
    credsStore.delete(token);
    return null;
  }
  return rec;
}
// GC expired tokens occasionally
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of credsStore.entries()) {
    if (now > v.expiresAt) credsStore.delete(k);
  }
}, 60_000);

// ---------- Static UI ----------
app.use(express.static(PUBLIC_DIR));

// ---------- Test listing ----------
app.get('/api/tests', (req, res) => {
  const files = fs.existsSync(TEST_DIR)
    ? fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.spec.js'))
    : [];
  res.json(files);
});

// ---------- Auth card: save / clear / token ----------
app.post('/api/auth/set', (req, res) => {
  const { user, pass } = req.body || {};
  if (!user || !pass) return res.status(400).json({ error: 'Missing user or pass' });
  state.hnUser = String(user);
  state.hnPass = String(pass);
  res.json({ ok: true });
});

app.post('/api/auth/clear', (_req, res) => {
  state.hnUser = null;
  state.hnPass = null;
  res.json({ ok: true });
});

app.post('/api/auth/submit', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username/password' });
  const token = setCreds(username, password);
  res.json({ ok: true, token, expiresInSec: 15 * 60 });
});

// ---------- Helper: spawn + pipe to SSE ----------
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const reporterPathFs = path.join(__dirname, 'mini-reporter.js');
const reporterArg = fs.existsSync(reporterPathFs)
  ? reporterPathFs.replace(/\\/g, '/') // Playwright accepts POSIX path separators
  : 'list';

function runSSE(req, res, cmd, args, extraEnv = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const child = spawn(cmd, args, {
    shell: false,        // better cross-platform behavior with explicit binaries
    cwd: ROOT,
    env: {
      ...process.env,
      ...extraEnv,
      FORCE_COLOR: '0',  // cleaner logs for SSE
    },
  });

  const send = (buf) => {
    const lines = buf.toString().split('\n');
    for (const line of lines) {
      if (line.length) res.write(`data: ${line}\n\n`);
    }
  };

  child.stdout.on('data', send);
  child.stderr.on('data', send);

  child.on('close', (code) => {
    res.write(`data: [TEST_EXIT_CODE] ${code}\n\n`);
    res.end();
  });

  req.on('close', () => child.kill());
}

// ---------- Known tests / scripts ----------
const testMap = {
  'ordering-full.spec.js': path.join(TEST_DIR, 'ordering-full.spec.js'),
  'links.spec.js': path.join(TEST_DIR, 'links.spec.js'),
  'tabs.spec.js': path.join(TEST_DIR, 'tabs.spec.js'),
  'auth.spec.js': path.join(TEST_DIR, 'auth.spec.js'),
  'auth-check': path.join(ROOT, 'auth-check.js'), // node script
};

// ---------- Stream a test (Playwright) or script (node) ----------
app.get('/api/stream-test/:name', (req, res) => {
  const { name } = req.params;
  const { token, headed } = req.query;

  // Resolve creds: token (one-off) overrides saved state
  const tokenCreds = token ? getCreds(String(token)) : null;
  const HN_USER = tokenCreds?.user ?? state.hnUser ?? '';
  const HN_PASS = tokenCreds?.pass ?? state.hnPass ?? '';

  // Special-case: auth-check is a plain node script
  if (name === 'auth-check') {
    const file = testMap['auth-check'];
    if (!fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: auth-check.js not found\n\n');
      res.write('data: [TEST_EXIT_CODE] 1\n\n');
      return res.end();
    }
    return runSSE(req, res, process.execPath, [path.relative(ROOT, file)], { HN_USER, HN_PASS });
  }

  // Playwright test file
  const file = testMap[name] || path.join(TEST_DIR, name);
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`data: Unknown test: ${name}\n\n`);
    res.write('data: [TEST_EXIT_CODE] 1\n\n');
    return res.end();
  }

  const cliArgs = [
    'playwright', 'test',
    path.relative(ROOT, file),
    '--reporter', reporterArg,
  ];

  // Optional headed mode: /api/stream-test/foo?headed=1
  if (headed === '1' || headed === 'true') {
    cliArgs.push('--headed');
  }

  runSSE(req, res, npxBin, cliArgs, { HN_USER, HN_PASS });
});

// ---------- Abort: client just closes SSE; we ack ----------
app.post('/api/abort/:name', (_req, res) => res.json({ ok: true }));

// ---------- SPA fallback (safe for Express v5 path-to-regexp) ----------
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ---------- Listen ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Test runner server at http://localhost:${PORT}`);
});
