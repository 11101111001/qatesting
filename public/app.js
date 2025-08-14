const { createApp } = Vue;

createApp({
  data() {
    return { tests: [] };
  },
  async mounted() {
    const res = await fetch('/api/tests');
    const files = await res.json();
    this.tests = files.map(f => ({
      name: f,
      status: 'idle',
      logs: [],
      showLogs: false
    }));
  },
  methods: {
    runTest(name) {
      const t = this.tests.find(x => x.name === name);
      if (!t) return;
      t.status = 'running';
      t.logs = [];
      t.showLogs = true;

      const es = new EventSource(`/api/run/${name}`);
      es.onmessage = e => {
        if (e.data.startsWith('[TEST_EXIT_CODE]')) {
          const code = parseInt(e.data.split(' ')[1], 10);
          t.status = code === 0 ? 'pass' : 'fail';
          es.close();
        } else {
          t.logs.push(e.data + '\n');
        }
      };
      es.onerror = () => es.close();
    },
    runScraper() {
      const name = 'Scraper';
      let t = this.tests.find(x => x.name === name);
      if (!t) {
        t = { name, status: 'idle', logs: [], showLogs: false };
        this.tests.unshift(t);
      }
      t.status = 'running';
      t.logs = [];
      t.showLogs = true;

      const es = new EventSource(`/api/run-scraper`);
      es.onmessage = e => {
        if (e.data.startsWith('[TEST_EXIT_CODE]')) {
          const code = parseInt(e.data.split(' ')[1], 10);
          t.status = code === 0 ? 'pass' : 'fail';
          es.close();
        } else {
          t.logs.push(e.data + '\n');
        }
      };
      es.onerror = () => es.close();
    },
    async runAll() {
      for (const t of this.tests) {
        await new Promise(resolve => {
          this.runTest(t.name);
          const check = setInterval(() => {
            if (t.status === 'pass' || t.status === 'fail') {
              clearInterval(check);
              resolve();
            }
          }, 500);
        });
      }
    }
  }
}).mount('#app');
