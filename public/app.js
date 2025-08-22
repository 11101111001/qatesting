// public/app.js
const { createApp } = window.Vue;

createApp({
  data() {
    return {
      tests: [],
      authUser: '',
      authPass: '',
      showPw: false,
      savingCreds: false,
      saveMsg: '',
      // Track EventSource per test for aborts
      streams: {},
    };
  },
  async mounted() {
    try {
      const res = await fetch('/api/tests');
      const files = await res.json();
      this.tests = files.map(f => ({
        name: f,
        status: 'idle',      // idle | running | pass | fail | aborted | error
        statusText: '',
        logs: [],
        showLogs: false,     // user toggles this; we won't touch it on run
        startedAt: 0,
        timerId: null,
      }));
    } catch (e) {
      console.error('Failed to load test list', e);
    }
  },
  methods: {
    // ---------- credentials ----------
    async saveCreds() {
      this.savingCreds = true;
      this.saveMsg = '';
      try {
        const resp = await fetch('/api/auth/set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: this.authUser, pass: this.authPass }),
        });
        if (!resp.ok) throw new Error(await resp.text());
        this.saveMsg = 'Credentials saved (in-memory).';
      } catch (e) {
        this.saveMsg = 'Failed to save: ' + (e?.message || e);
      } finally {
        this.savingCreds = false;
        setTimeout(() => (this.saveMsg = ''), 4000);
      }
    },
    verifyLoginNow() {
      // Optional: this pseudo-test starts with logs open to show the check
      const name = 'auth-check';
      let t = this.tests.find(x => x.name === name);
      if (!t) {
        t = { name, status: 'idle', statusText: '', logs: [], showLogs: true, startedAt: 0, timerId: null };
        this.tests.unshift(t);
      }
      this.runSSE(name, t);
    },

    // ---------- test runner ----------
    runTest(name) {
      const t = this.tests.find(x => x.name === name);
      if (!t) return;
      this.runSSE(name, t);
    },

    runSSE(name, t) {
      // Close existing if any
      this.abortTest(name);

      t.status = 'running';
      t.statusText = 'starting…';
      t.logs = [];            // clear logs for the new run
      // DO NOT touch t.showLogs here (preserve user’s open/closed choice)
      t.startedAt = Date.now();

      const TIMEOUT_MS = 90_000; // 90s per run
      const escName = encodeURIComponent(name);
      const es = new EventSource(`/api/stream-test/${escName}`);
      this.streams[name] = es;

      // timeout watchdog
      t.timerId = setTimeout(() => {
        this.appendLog(t, '[timeout] test exceeded time limit');
        this.finishTest(t, 'fail', `timed out after ${Math.round(TIMEOUT_MS / 1000)}s`);
        es.close();
      }, TIMEOUT_MS);

      es.onmessage = (e) => {
        const line = e.data || '';
        if (line.startsWith('[TEST_EXIT_CODE]')) {
          const code = parseInt(line.split(' ')[1], 10);
          if (code === 0) {
            this.finishTest(t, 'pass', 'completed');
          } else {
            this.finishTest(t, 'fail', `exit ${code}`);
          }
          es.close();
          return;
        }
        // live status hints
        if (/^Running \d+ tests/.test(line)) t.statusText = 'running';
        if (/^✓/.test(line)) t.statusText = 'assertions passing';
        if (/^✘/.test(line) || /FAIL|Error:/i.test(line)) t.statusText = 'assertion failed';
        this.appendLog(t, line);
      };

      es.onerror = () => {
        // If still running, mark as error
        if (t.status === 'running') {
          this.appendLog(t, '[error] SSE connection closed unexpectedly');
          this.finishTest(t, 'error', 'connection lost');
        }
        es.close();
      };
    },

    appendLog(t, line) {
      // Keep log list bounded
      if (t.logs.length > 5000) t.logs.splice(0, 1000);
      t.logs.push(line);
    },

    finishTest(t, status, statusText = '') {
      t.status = status;
      t.statusText = statusText;
      if (t.timerId) {
        clearTimeout(t.timerId);
        t.timerId = null;
      }
      const name = t.name;
      if (this.streams[name]) {
        this.streams[name].close();
        delete this.streams[name];
      }
    },

    abortTest(name) {
      const t = this.tests.find(x => x.name === name);
      const stream = this.streams[name];
      if (stream) {
        stream.close();
        delete this.streams[name];
      }
      fetch(`/api/abort/${encodeURIComponent(name)}`, { method: 'POST' }).catch(() => {});
      if (t && t.status === 'running') {
        if (t.timerId) {
          clearTimeout(t.timerId);
          t.timerId = null;
        }
        t.status = 'aborted';
        t.statusText = 'stopped by user';
      }
    },

    async runAll() {
      for (const t of this.tests) {
        await new Promise((resolve) => {
          this.runSSE(t.name, t);
          const poll = setInterval(() => {
            if (['pass', 'fail', 'error', 'aborted'].includes(t.status)) {
              clearInterval(poll);
              resolve();
            }
          }, 400);
        });
      }
    },

    resetAll() {
      // Abort all streams and clear statuses/logs
      for (const [name, es] of Object.entries(this.streams)) {
        es.close();
        fetch(`/api/abort/${encodeURIComponent(name)}`, { method: 'POST' }).catch(() => {});
      }
      this.streams = {};
      for (const t of this.tests) {
        if (t.timerId) {
          clearTimeout(t.timerId);
          t.timerId = null;
        }
        t.status = 'idle';
        t.statusText = '';
        t.logs = [];
        t.showLogs = false; // closed on Reset only
      }
      this.saveMsg = '';
    },
  },
}).mount('#app');
