// server/mini-reporter.js (CommonJS for Windows/macOS/Linux compatibility)
class MiniReporter {
  onBegin(config, suite) {
    this._t0 = Date.now();
    this._passed = 0;
    this._failed = 0;
    this._skipped = 0;

    const total = suite.allTests().length;
    console.log(`RUN ${total} tests`);
  }

  onTestBegin(test) {
    const title = this._title(test);
    console.log(`▶ ${title}`);
  }

  onTestEnd(test, result) {
    const title = this._title(test);
    const dur = `${(result.duration / 1000).toFixed(1)}s`;

    if (result.status === 'passed') {
      this._passed++;
      console.log(`✔ PASS ${title} (${dur})`);
      return;
    }
    if (result.status === 'skipped') {
      this._skipped++;
      console.log(`⏭ SKIP ${title}`);
      return;
    }

    this._failed++;
    const msg = (result.error && result.error.message ? result.error.message : '')
      .split('\n')[0]
      .trim();
    const where = result.error && result.error.location
      ? ` @ ${result.error.location.file}:${result.error.location.line}:${result.error.location.column}`
      : '';
    console.log(`✖ FAIL ${title}${msg ? ` — ${msg}` : ''}${where}`);
  }

  onEnd() {
    const secs = ((Date.now() - this._t0) / 1000).toFixed(1);
    console.log(`SUMMARY: ${this._passed} passed, ${this._failed} failed, ${this._skipped} skipped. Duration: ${secs}s`);
  }

  _title(test) {
    // “suite › test title”, compact and readable
    // titlePath() returns like: [file, ...suites, testTitle]
    const parts = test.titlePath().slice(1); // drop file
    return parts.join(' › ');
  }
}

module.exports = MiniReporter;
