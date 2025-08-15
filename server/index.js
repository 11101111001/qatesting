// server/index.js
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const crypto = require('crypto');

// ephemeral token -> { user, pass, expiresAt }
const credsStore = new Map();
function newToken() {
  return crypto.randomBytes(16).toString('hex');
}
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
// GC occasionally
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of credsStore.entries()) {
    if (now > v.expiresAt) credsStore.delete(k);
  }
}, 60_000);

const app = express();
app.use(express.json());

const ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'tests');
const PUBLIC_DIR = path.join(ROOT, 'public');

const state = { hnUser: null, hnPass: null };

// Serve static frontend first
app.use(express.static(PUBLIC_DIR));

/** List tests */
app.get('/api/tests', (req, res) => {
  const files = fs.existsSync(TEST_DIR)
    ? fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.spec.js'))
    : [];
  res.json(files);
});

/** Save credentials (card only sets these; does not run tests) */
app.post('/api/auth/set', (req, res) => {
  const { user, pass } = req.body || {};
  if (!user || !pass) return res.status(400).json({ error: 'Missing user or pass' });
  state.hnUser = String(user);
  state.hnPass = String(pass);
  res.json({ ok: true });
});

/** Clear credentials (optional) */
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

/** Helper to stream a child process over SSE */
function runSSE(req, res, cmd, args, env = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const child = spawn(cmd, args, {
    shell: true,
    env: { ...process.env, ...env, FORCE_COLOR: '1' },
    cwd: ROOT,
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

/** Map names to files */
const testMap = {
  'ordering-full.spec.js': path.join(TEST_DIR, 'ordering-full.spec.js'),
  'links.spec.js': path.join(TEST_DIR, 'links.spec.js'),
  'tabs.spec.js': path.join(TEST_DIR, 'tabs.spec.js'),
  'auth.spec.js': path.join(TEST_DIR, 'auth.spec.js'),
  'auth-check': path.join(ROOT, 'auth-check.js'), // node script
};

/** Run test or node script via SSE */
app.get('/api/stream-test/:name', (req, res) => {
  const { name } = req.params;
  const token = req.query.token;

  // Special-case first: auth-check always runs with Node
  if (name === 'auth-check') {
    const file = testMap['auth-check'];
    if (!fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: auth-check.js not found\n\n');
      res.write('data: [TEST_EXIT_CODE] 1\n\n');
      return res.end();
    }
    return runSSE(
      req,
      res,
      'node',
      [path.relative(ROOT, file)],
      { HN_USER: state.hnUser || '', HN_PASS: state.hnPass || '' }
    );
  }

  // Otherwise treat :name as a Playwright test file
  const file = testMap[name] || path.join(TEST_DIR, name);
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`data: Unknown test: ${name}\n\n`);
    res.write('data: [TEST_EXIT_CODE] 1\n\n');
    return res.end();
  }

  runSSE(
    req,
    res,
    'npx',
    ['playwright', 'test', path.relative(ROOT, file), '--reporter', 'list'],
    { HN_USER: state.hnUser || '', HN_PASS: state.hnPass || '' }
  );
});

/** Abort endpoint (client closes SSE; we ack) */
app.post('/api/abort/:name', (_req, res) => res.json({ ok: true }));

/** SPA fallback (Express v5-friendly regex; avoids path-to-regexp crash) */
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Test runner server at http://localhost:${PORT}`);
});
