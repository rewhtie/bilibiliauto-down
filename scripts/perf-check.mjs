#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const NEXT_DIR = path.join(PROJECT_ROOT, '.next');
const REPORT_FILE = path.join(NEXT_DIR, 'perf-report.json');
const DEFAULT_CONFIG_FILE = path.join(PROJECT_ROOT, 'perf-budget.json');

const args = process.argv.slice(2);
const configArg = args.find((arg) => arg.startsWith('--config='));
const configFile = configArg
  ? path.resolve(PROJECT_ROOT, configArg.split('=')[1] || '')
  : DEFAULT_CONFIG_FILE;

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatSignedKB(bytes) {
  const sign = bytes > 0 ? '+' : '';
  return `${sign}${(bytes / 1024).toFixed(1)} KB`;
}

function fail(message) {
  console.error(`perf-check failed: ${message}`);
  process.exit(1);
}

function getMetric(report, metricName) {
  return Number(report?.totals?.[metricName] || 0);
}

function assertMetric(results, metricName, current, limit) {
  if (typeof limit !== 'number') {
    return;
  }
  if (current <= limit) {
    results.push(
      `PASS ${metricName}: ${formatKB(current)} <= ${formatKB(limit)}`
    );
    return;
  }

  results.push(
    `FAIL ${metricName}: ${formatKB(current)} > ${formatKB(limit)}`
  );
}

function assertDelta(results, metricName, current, baseline, maxDelta) {
  if (typeof maxDelta !== 'number') {
    return;
  }
  const delta = current - baseline;
  if (delta <= maxDelta) {
    results.push(
      `PASS ${metricName} delta: ${formatSignedKB(delta)} <= ${formatKB(maxDelta)}`
    );
    return;
  }

  results.push(
    `FAIL ${metricName} delta: ${formatSignedKB(delta)} > ${formatKB(maxDelta)}`
  );
}

function main() {
  if (!fileExists(configFile)) {
    fail(`missing config file: ${path.relative(PROJECT_ROOT, configFile)}`);
  }
  if (!fileExists(REPORT_FILE)) {
    fail(
      `missing report file: ${path.relative(
        PROJECT_ROOT,
        REPORT_FILE
      )}. Run "pnpm perf:report" after build.`
    );
  }

  const config = readJson(configFile);
  const report = readJson(REPORT_FILE);

  if (config.route && report.route && config.route !== report.route) {
    fail(`route mismatch: config=${config.route}, report=${report.route}`);
  }

  const budgets = config.budgets || {};
  const baselineConfig = config.baseline || {};
  const baselinePath = path.resolve(
    PROJECT_ROOT,
    baselineConfig.file || 'perf-baseline.json'
  );
  const baselineExists = fileExists(baselinePath);
  const baselineReport = baselineExists ? readJson(baselinePath) : null;

  if (baselineConfig.required && !baselineExists) {
    fail(
      `baseline required but missing: ${path.relative(PROJECT_ROOT, baselinePath)}`
    );
  }

  const metrics = [
    'initialJsBytes',
    'initialCssBytes',
    'lazyJsBytes',
  ];

  const lines = [];
  const failures = [];

  metrics.forEach((metricName) => {
    const current = getMetric(report, metricName);
    const limit = budgets[metricName];
    const start = lines.length;
    assertMetric(lines, metricName, current, limit);
    if (lines.length > start && lines[lines.length - 1].startsWith('FAIL')) {
      failures.push(lines[lines.length - 1]);
    }

    if (baselineReport) {
      const baselineValue = getMetric(baselineReport, metricName);
      const deltaKey = `max${metricName[0].toUpperCase()}${metricName.slice(1, -5)}DeltaBytes`;
      // Build keys explicitly for readability and to avoid fragile naming.
      const maxDelta = metricName === 'initialJsBytes'
        ? baselineConfig.maxInitialJsDeltaBytes
        : metricName === 'initialCssBytes'
          ? baselineConfig.maxInitialCssDeltaBytes
          : baselineConfig.maxLazyJsDeltaBytes;

      const beforeLen = lines.length;
      assertDelta(lines, metricName, current, baselineValue, maxDelta);
      if (lines.length > beforeLen && lines[lines.length - 1].startsWith('FAIL')) {
        failures.push(lines[lines.length - 1]);
      }

      void deltaKey;
    }
  });

  console.log(`Config: ${path.relative(PROJECT_ROOT, configFile)}`);
  console.log(`Report: ${path.relative(PROJECT_ROOT, REPORT_FILE)}`);
  if (baselineReport) {
    console.log(`Baseline: ${path.relative(PROJECT_ROOT, baselinePath)}`);
  } else {
    console.log(`Baseline: (none)`);
  }

  lines.forEach((line) => console.log(line));

  if (failures.length > 0) {
    fail('budget check has failing metrics');
  }

  console.log('perf-check passed');
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
}
