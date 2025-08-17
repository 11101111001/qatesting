// @ts-check
import { defineConfig, devices } from '@playwright/test';

const RUN_AUTH = process.env.RUN_AUTH === '1';

const isHeaded = /^(1|true|yes)$/i.test(process.env.HEADED ?? '');
const workersEnv = process.env.WORKERS ? Number(process.env.WORKERS) : undefined;
const projectsEnv = (process.env.PROJECTS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allProjects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
];

const pickProjects = projectsEnv.length
  ? allProjects.filter(p => projectsEnv.includes(p.name))
  : allProjects;

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['dot'], ['html']] : 'list',
  workers: isHeaded ? (workersEnv ?? 1) : (workersEnv ?? undefined),

  use: {
    baseURL: 'https://news.ycombinator.com',
    headless: !isHeaded,
    navigationTimeout: 25_000,
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'retain-on-failure',
  },
  grepInvert: RUN_AUTH ? undefined : /@auth/,

  projects: pickProjects,
});
