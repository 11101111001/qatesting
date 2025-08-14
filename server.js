// server.js
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Get test list
app.get('/api/tests', (req, res) => {
  const dir = path.join(__dirname, 'tests');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => f.endsWith('.spec.js'))
    : [];
  res.json(files);
});

// Helper to stream process output over SSE
function runCommandSSE(res, cmd, args, cwd) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const proc = spawn(cmd, args, { cwd });

  const send = msg => res.write(`data: ${msg.replace(/\n/g, '\ndata: ')}\n\n`);

  proc.stdout.on('data', d => send(d.toString()));
  proc.stderr.on('data', d => send(d.toString()));

  proc.on('close', code => {
    send(`[TEST_EXIT_CODE] ${code}`);
    res.end();
  });
}

// Run one Playwright test
app.get('/api/run/:file', (req, res) => {
  const testFile = path.join(__dirname, 'tests', req.params.file);
  if (!fs.existsSync(testFile)) {
    res.status(404).end('data: Test not found\n\n');
    return;
  }
  runCommandSSE(res, 'npx', ['playwright', 'test', testFile], __dirname);
});

// Run scraper
app.get('/api/run-scraper', (req, res) => {
  runCommandSSE(res, 'node', ['index.js', '--limit=20'], __dirname);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
