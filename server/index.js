// server/index.js (CommonJS)
// Unified server: static frontend + SSE streaming + test listing + scraper
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TESTS_DIR = path.join(ROOT, 'tests');
const DEFAULT_TEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Track currently running SSE tests by name (so we can abort/reset)
const runs = new Map(); // name -> { proc, res, keepAlive, killer }

// --- Serve static frontend (serves / and assets) ---
app.use(express.static(PUBLIC_DIR, { index: 'index.html' }));

// --- Utility: start a tracked SSE run (with keep-alive + timeout + cleanup) ---
function startTrackedRun(name, res, cmd, args, opts = {}) {
  const {
    cwd = ROOT,
    timeoutMs = DEFAULT_TEST_TIMEOUT_MS,
    env = process.env,
  } = opts;

  // If a test with this name is already running, abort & replace it
  const existing = runs.get(name);
  if (existing) {
    try {
      existing.res.write(`data: [TEST_ABORTED] Replaced by new run\n\n`);
      try { existing.proc.kill('SIGKILL'); } catch {}
      clearInterval(existing.keepAlive);
      clearTimeout(existing.killer);
      existing.res.end();
    } catch {}
    runs.delete(name);
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const send = (msg) => {
    const str = String(msg);
    res.write(`data: ${str.replace(/\n/g, '\ndata: ')}\n\n`);
  };

  // keep-alive ping
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  // hard timeout
  const killer = setTimeout(() => {
    send(`[TEST_TIMEOUT] Exceeded ${Math.round(timeoutMs / 1000)}s`);
    try { proc.kill('SIGKILL'); } catch {}
  }, timeoutMs);

  const proc = spawn(cmd, args, {
    cwd,
    shell: true,
    env: { ...env, FORCE_COLOR: '1' },
  });

  runs.set(name, { proc, res, keepAlive, killer });

  proc.stdout.on('data', (d) => send(d.toString()));
  proc.stderr.on('data', (d) => send(d.toString()));

  const cleanup = (code) => {
    clearInterval(keepAlive);
    clearTimeout(killer);
    runs.delete(name);
    send(`[TEST_EXIT_CODE] ${code}`);
    res.end();
  };

  proc.on('close', (code) => cleanup(code));

  // client closed early
  res.on('close', () => {
    if (runs.has(name)) {
      try { proc.kill(); } catch {}
      clearInterval(keepAlive);
      clearTimeout(killer);
      runs.delete(name);
    }
  });
}

// --- API: list tests ---
app.get('/api/tests', (req, res) => {
  const files = fs.existsSync(TESTS_DIR)
    ? fs.readdirSync(TESTS_DIR).filter(f => f.endsWith('.spec.js'))
    : [];
  res.json(files);
});

// --- API: run test by exact filename (still available) ---
app.get('/api/run/:file', (req, res) => {
  const testFile = path.join(TESTS_DIR, req.params.file);
  if (!fs.existsSync(testFile)) {
    res.status(404).end('data: Test not found\n\n');
    return;
  }
  // use name = filename for tracking
  const name = req.params.file.replace(/\.spec\.js$/, '');
  startTrackedRun(name, res, 'npx', ['playwright', 'test', testFile, '--reporter', 'list']);
});

// --- API: run scraper CLI (root-level index.js) ---
app.get('/api/run-scraper', (req, res) => {
  startTrackedRun('Scraper', res, 'node', ['index.js', '--limit=20']);
});

// --- API: stream by simple name (e.g., /api/stream-test/ordering-full) ---
app.get('/api/stream-test/:name', (req, res) => {
  const name = req.params.name;
  const base = name.endsWith('.spec.js') ? name : `${name}.spec.js`;
  const testFile = path.join(TESTS_DIR, base);
  if (!fs.existsSync(testFile)) {
    res.write(`data: Unknown test: ${name}\n\n`);
    return res.end();
  }
  startTrackedRun(name, res, 'npx', ['playwright', 'test', testFile, '--reporter', 'list']);
});

// --- API: abort a running test by name ---
app.get('/api/abort/:name', (req, res) => {
  const name = req.params.name;
  const run = runs.get(name);
  if (!run) {
    return res.status(404).json({ ok: false, message: 'No running test' });
  }
  try {
    run.res.write(`data: [TEST_ABORTED] Aborted by user\n\n`);
    try { run.proc.kill('SIGKILL'); } catch {}
    clearInterval(run.keepAlive);
    clearTimeout(run.killer);
    run.res.end();
  } catch {}
  runs.delete(name);
  res.json({ ok: true });
});

// --- API: reset (abort everything) ---
app.get('/api/reset', (req, res) => {
  for (const [name, run] of runs.entries()) {
    try {
      run.res.write(`data: [TEST_ABORTED] Reset requested\n\n`);
      try { run.proc.kill('SIGKILL'); } catch {}
      clearInterval(run.keepAlive);
      clearTimeout(run.killer);
      run.res.end();
    } catch {}
  }
  runs.clear();
  res.json({ ok: true });
});

// --- SPA fallback: for non-API GET/HEAD, return index.html ---
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
