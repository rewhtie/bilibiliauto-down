#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const PROJECT_ROOT = process.cwd();
const NEXT_DIR = path.join(PROJECT_ROOT, '.next');
const DEFAULT_BASELINE_FILE = path.join(PROJECT_ROOT, 'perf-baseline.json');
const REPORT_FILE = path.join(NEXT_DIR, 'perf-report.json');

const args = new Set(process.argv.slice(2));
const shouldSaveBaseline = args.has('--save-baseline');
const baselineArg = [...args].find((arg) => arg.startsWith('--baseline='));
const baselineFile = baselineArg
  ? path.resolve(PROJECT_ROOT, baselineArg.split('=')[1] || '')
  : DEFAULT_BASELINE_FILE;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function unique(items) {
  return [...new Set(items)];
}

function normalizeChunkPath(chunkPath) {
  if (chunkPath.startsWith('/_next/')) {
    return chunkPath.slice('/_next/'.length);
  }
  return chunkPath.replace(/^\/+/, '');
}

function chunkFilePath(chunkPath) {
  return path.join(NEXT_DIR, normalizeChunkPath(chunkPath));
}

function sizeOfChunk(chunkPath) {
  const absolutePath = chunkFilePath(chunkPath);
  if (!fileExists(absolutePath)) {
    return 0;
  }
  return fs.statSync(absolutePath).size;
}

function toSizeRows(files) {
  return files.map((file) => ({
    file,
    bytes: sizeOfChunk(file),
  }));
}

function sumBytes(rows) {
  return rows.reduce((acc, row) => acc + row.bytes, 0);
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatSignedKB(bytes) {
  const sign = bytes > 0 ? '+' : '';
  return `${sign}${(bytes / 1024).toFixed(1)} KB`;
}

function loadRscManifest(filePath, routeKey) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sandbox = { globalThis: { __RSC_MANIFEST: {} } };
  vm.runInNewContext(content, sandbox, { filename: filePath });

  const manifest = sandbox.globalThis.__RSC_MANIFEST?.[routeKey];
  if (!manifest) {
    throw new Error(`Failed to find RSC manifest route key: ${routeKey}`);
  }
  return manifest;
}

function findEntryKey(entryMap, suffix) {
  return Object.keys(entryMap).find((key) => key.endsWith(suffix));
}

function collectStaticChunkTopN(limit = 15) {
  const chunksDir = path.join(NEXT_DIR, 'static', 'chunks');
  if (!fileExists(chunksDir)) {
    return [];
  }

  const rows = fs
    .readdirSync(chunksDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !name.endsWith('.map'))
    .map((name) => {
      const rel = path.posix.join('static/chunks', name);
      return {
        file: rel,
        bytes: sizeOfChunk(rel),
      };
    })
    .sort((a, b) => b.bytes - a.bytes);

  return rows.slice(0, limit);
}

function collectReport() {
  const buildManifestPath = path.join(NEXT_DIR, 'build-manifest.json');
  const rscManifestPath = path.join(
    NEXT_DIR,
    'server',
    'app',
    '[locale]',
    'page_client-reference-manifest.js'
  );
  const routeBuildManifestPath = path.join(
    NEXT_DIR,
    'server',
    'app',
    '[locale]',
    'page',
    'build-manifest.json'
  );
  const routeLoadableManifestPath = path.join(
    NEXT_DIR,
    'server',
    'app',
    '[locale]',
    'page',
    'react-loadable-manifest.json'
  );

  const requiredFiles = [
    buildManifestPath,
    rscManifestPath,
    routeBuildManifestPath,
    routeLoadableManifestPath,
  ];
  for (const filePath of requiredFiles) {
    if (!fileExists(filePath)) {
      throw new Error(
        `Missing required build artifact: ${path.relative(PROJECT_ROOT, filePath)}`
      );
    }
  }

  const rootBuildManifest = readJson(buildManifestPath);
  const routeBuildManifest = readJson(routeBuildManifestPath);
  const routeLoadableManifest = readJson(routeLoadableManifestPath);
  const rscManifest = loadRscManifest(rscManifestPath, '/[locale]/page');

  const entryJSFiles = rscManifest.entryJSFiles || {};
  const entryCSSFiles = rscManifest.entryCSSFiles || {};
  const pageEntryKey = findEntryKey(entryJSFiles, '/src/app/[locale]/page');
  const layoutEntryKey = findEntryKey(entryJSFiles, '/src/app/[locale]/layout');

  const pageEntryJs = pageEntryKey ? entryJSFiles[pageEntryKey] || [] : [];
  const layoutEntryJs = layoutEntryKey ? entryJSFiles[layoutEntryKey] || [] : [];
  const pageEntryCss = pageEntryKey ? (entryCSSFiles[pageEntryKey] || []).map((item) => item.path) : [];
  const layoutEntryCss = layoutEntryKey ? (entryCSSFiles[layoutEntryKey] || []).map((item) => item.path) : [];

  const rootMainFiles = unique([
    ...(rootBuildManifest.rootMainFiles || []),
    ...(routeBuildManifest.rootMainFiles || []),
  ]);
  const polyfillFiles = unique([
    ...(rootBuildManifest.polyfillFiles || []),
    ...(routeBuildManifest.polyfillFiles || []),
  ]);

  const initialJsFiles = unique([
    ...polyfillFiles,
    ...rootMainFiles,
    ...layoutEntryJs.map(normalizeChunkPath),
    ...pageEntryJs.map(normalizeChunkPath),
  ]);
  const initialCssFiles = unique([
    ...layoutEntryCss.map(normalizeChunkPath),
    ...pageEntryCss.map(normalizeChunkPath),
  ]);

  const allDynamicFiles = unique(
    Object.values(routeLoadableManifest).flatMap((item) => item.files || [])
  ).map(normalizeChunkPath);

  const lazyJsFiles = allDynamicFiles.filter(
    (file) => file.endsWith('.js') && !initialJsFiles.includes(file)
  );
  const lazyCssFiles = allDynamicFiles.filter(
    (file) => file.endsWith('.css') && !initialCssFiles.includes(file)
  );

  const trackedModules = [
    'src/app/[locale]/unified-downloader-client.tsx',
    'src/components/deferred-toaster.tsx',
    'src/components/deferred-analytics.tsx',
    'src/components/deferred-web-vitals-tracker.tsx',
    'src/components/deferred-feedback-dialog.tsx',
    'src/components/deferred-changelog-dialog.tsx',
    'src/components/deferred-language-switcher.tsx',
    'src/components/ads/viewport-side-rail-ad.tsx',
    'src/components/downloader/ResultCard.tsx',
  ];

  const moduleChunkGroups = trackedModules.map((modulePath) => {
    const matched = Object.entries(rscManifest.clientModules || {}).find(
      ([key]) => key.includes(modulePath) && !key.includes('<module evaluation>')
    );
    if (!matched) {
      return { module: modulePath, chunks: [], totalBytes: 0 };
    }
    const chunks = unique((matched[1].chunks || []).map(normalizeChunkPath));
    const rows = toSizeRows(chunks);
    return {
      module: modulePath,
      chunks: rows,
      totalBytes: sumBytes(rows),
    };
  });

  const initialJsRows = toSizeRows(initialJsFiles).sort((a, b) => b.bytes - a.bytes);
  const initialCssRows = toSizeRows(initialCssFiles).sort((a, b) => b.bytes - a.bytes);
  const lazyJsRows = toSizeRows(lazyJsFiles).sort((a, b) => b.bytes - a.bytes);
  const lazyCssRows = toSizeRows(lazyCssFiles).sort((a, b) => b.bytes - a.bytes);

  return {
    generatedAt: new Date().toISOString(),
    route: '/[locale]/page',
    reference: {
      pageEntryKey: pageEntryKey || null,
      layoutEntryKey: layoutEntryKey || null,
      rootMainFiles: rootMainFiles.map((file) => normalizeChunkPath(file)),
      polyfillFiles: polyfillFiles.map((file) => normalizeChunkPath(file)),
    },
    totals: {
      initialJsBytes: sumBytes(initialJsRows),
      initialCssBytes: sumBytes(initialCssRows),
      lazyJsBytes: sumBytes(lazyJsRows),
      lazyCssBytes: sumBytes(lazyCssRows),
    },
    files: {
      initialJs: initialJsRows,
      initialCss: initialCssRows,
      lazyJs: lazyJsRows,
      lazyCss: lazyCssRows,
      topStaticChunks: collectStaticChunkTopN(),
    },
    moduleChunkGroups,
  };
}

function printRows(title, rows, limit = 8) {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log('  (none)');
    return;
  }

  rows.slice(0, limit).forEach((row) => {
    console.log(`  - ${row.file}: ${formatKB(row.bytes)}`);
  });
}

function printModuleGroups(groups) {
  console.log('\nTracked module chunk groups');
  groups.forEach((group) => {
    console.log(`  - ${group.module}: ${formatKB(group.totalBytes)}`);
    if (!group.chunks.length) {
      console.log('    chunks: (none)');
      return;
    }
    const list = group.chunks.map((chunk) => `${chunk.file} (${formatKB(chunk.bytes)})`);
    console.log(`    chunks: ${list.join(', ')}`);
  });
}

function tryReadBaseline(filePath) {
  if (!fileExists(filePath)) {
    return null;
  }
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function printBaselineDiff(current, baseline) {
  if (!baseline?.totals) {
    return;
  }

  const jsDelta = current.totals.initialJsBytes - baseline.totals.initialJsBytes;
  const cssDelta = current.totals.initialCssBytes - baseline.totals.initialCssBytes;
  const lazyJsDelta = current.totals.lazyJsBytes - baseline.totals.lazyJsBytes;

  console.log('\nBaseline diff');
  console.log(`  - initial JS: ${formatSignedKB(jsDelta)}`);
  console.log(`  - initial CSS: ${formatSignedKB(cssDelta)}`);
  console.log(`  - lazy JS: ${formatSignedKB(lazyJsDelta)}`);
}

function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fileExists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  const report = collectReport();
  writeJsonFile(REPORT_FILE, report);

  console.log(`Saved report: ${path.relative(PROJECT_ROOT, REPORT_FILE)}`);
  console.log(`Route: ${report.route}`);
  console.log(`Initial JS: ${formatKB(report.totals.initialJsBytes)}`);
  console.log(`Initial CSS: ${formatKB(report.totals.initialCssBytes)}`);
  console.log(`Lazy JS: ${formatKB(report.totals.lazyJsBytes)}`);
  console.log(`Lazy CSS: ${formatKB(report.totals.lazyCssBytes)}`);

  printRows('Initial JS files', report.files.initialJs);
  printRows('Initial CSS files', report.files.initialCss);
  printRows('Largest lazy JS files', report.files.lazyJs);
  printRows('Largest static chunk files', report.files.topStaticChunks, 10);
  printModuleGroups(report.moduleChunkGroups);

  const baseline = tryReadBaseline(baselineFile);
  if (baseline) {
    console.log(`\nBaseline file: ${path.relative(PROJECT_ROOT, baselineFile)}`);
    printBaselineDiff(report, baseline);
  } else {
    console.log(
      `\nBaseline file not found: ${path.relative(PROJECT_ROOT, baselineFile)}`
    );
  }

  if (shouldSaveBaseline) {
    writeJsonFile(baselineFile, report);
    console.log(`Saved baseline: ${path.relative(PROJECT_ROOT, baselineFile)}`);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`perf-report failed: ${message}`);
  process.exit(1);
}
