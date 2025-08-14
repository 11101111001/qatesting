document.getElementById('runScraper').onclick = async () => {
  const res = await fetch('/run-scraper');
  const { code, output } = await res.json();
  document.getElementById('output').textContent = output + `\nExit code: ${code}`;
};

document.getElementById('runSmoke').onclick = async () => {
  const res = await fetch('/run-test/smoke.spec.js');
  const { code, output } = await res.json();
  document.getElementById('output').textContent = output + `\nExit code: ${code}`;
};
