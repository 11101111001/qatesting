const { createApp } = Vue;

createApp({
  data() {
    return {
      tests: [],
      timeoutMs: 5 * 60 * 1000, // client-side timeout safety (still have server-side)
      streams: {},              // name -> EventSource
      timers: {}                // name -> timeout id
    };
  },
  async mounted() {
    const res = await fetch('/api/tests');
    const files = await res.json();
    this.tests = files.map(f => ({
      name: f.replace(/\.spec\.js$/, ''),
      status: 'idle',   // idle | running | pass | fail | timeout | aborted
      statusText: '',
      logs: [],
      showLogs: false
    }));
    // Optional: also show Scraper as a pseudo-test
    if (!this.tests.find(t => t.name === 'Scraper')) {
      this.tests.unshift({ name: 'Scraper', status: 'idle', statusText: '', logs: [], showLogs: false });
    }
  },
  methods: {
    // Clean up local handles
    _clearLocal(name) {
      const es = this.streams[name];
      if (es) {
        try { es.close(); } catch {}
        delete this.streams[name];
      }
      if (this.timers[name]) {
        clearTimeout(this.timers[name]);
        delete this.timers[name];
      }
    },

    runTest(name) {
      const t = this.tests.find(x => x.name === name);
      if (!t) return;

      // If already running, abort previous client stream (server will also replace)
      this._clearLocal(name);

      t.status = 'running';
      t.statusText = `Running: ${name}`;
      t.logs = [];
      t.showLogs = true;

      const isScraper = name === 'Scraper';
      const url = isScraper ? `/api/run-scraper` : `/api/stream-test/${name}`;
      const es = new EventSource(url);
      this.streams[name] = es;

      // client-side timeout (server also enforces one)
      this.timers[name] = setTimeout(() => {
        t.status = 'timeout';
        t.statusText = 'Timed out';
        this._clearLocal(name);
        t.logs.push(`[TIMEOUT] Client-side: exceeded ${this.timeoutMs / 1000}s`);
      }, this.timeoutMs);

      es.onmessage = (e) => {
        if (e.data.startsWith('[TEST_EXIT_CODE]')) {
          const code = parseInt(e.data.split(' ')[1], 10);
          t.status = code === 0 ? 'pass' : 'fail';
          t.statusText = t.status === 'pass' ? 'Passed' : 'Failed';
          this._clearLocal(name);
        } else if (e.data.startsWith('[TEST_ABORTED]')) {
          t.status = 'aborted';
          t.statusText = 'Aborted';
          this._clearLocal(name);
        } else if (e.data.startsWith('[TEST_TIMEOUT]')) {
          t.status = 'timeout';
          t.statusText = 'Timed out (server)';
          this._clearLocal(name);
        } else if (e.data.startsWith('[TEST_STATUS]')) {
          // If you ever emit progress lines from tests
          t.statusText = e.data.replace('[TEST_STATUS]', '').trim();
        } else {
          t.logs.push(e.data);
        }
      };

      es.onerror = () => {
        // Only mark as fail if we didn’t just finalize
        if (t.status === 'running') {
          t.status = 'fail';
          t.statusText = 'Connection error';
        }
        this._clearLocal(name);
      };
    },

    // Abort a single test (server kills process)
    async abortTest(name) {
      const t = this.tests.find(x => x.name === name);
      if (!t) return;

      try {
        await fetch(`/api/abort/${encodeURIComponent(name)}`);
      } catch {}
      // Optimistic local cleanup; server will also send [TEST_ABORTED] if stream still open
      this._clearLocal(name);
      if (t.status === 'running') {
        t.status = 'aborted';
        t.statusText = 'Aborted';
      }
    },

    // Reset all (server aborts all, UI cleared)
    async resetAll() {
      try {
        await fetch('/api/reset');
      } catch {}
      // Local cleanup
      for (const name of Object.keys(this.streams)) {
        this._clearLocal(name);
      }
      for (const t of this.tests) {
        t.status = 'idle';
        t.statusText = '';
        t.logs = [];
        t.showLogs = false;
      }
    },

    // Convenience: run everything sequentially
    async runAll() {
      for (const t of this.tests) {
        this.runTest(t.name);
        await new Promise(resolve => {
          const check = setInterval(() => {
            if (['pass', 'fail', 'timeout', 'aborted'].includes(t.status)) {
              clearInterval(check);
              resolve();
            }
          }, 300);
        });
      }
    }
  }
}).mount('#app');
