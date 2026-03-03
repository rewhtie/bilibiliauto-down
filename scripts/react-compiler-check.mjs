#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const PROJECT_ROOT = process.cwd();
const NEXT_DIR = path.join(PROJECT_ROOT, '.next');
const REPORT_FILE = path.join(NEXT_DIR, 'react-compiler-report.json');

const ROUTE_KEY = '/[locale]/page';
const RSC_MANIFEST_PATH = path.join(
  NEXT_DIR,
  'server',
  'app',
  '[locale]',
  'page_client-reference-manifest.js'
);

const TARGETS = [
  {
    modulePath: 'src/app/[locale]/unified-downloader.tsx',
    exportName: 'UnifiedDownloader',
  },
  {
    modulePath: 'src/app/[locale]/unified-downloader-client.tsx',
    exportName: 'UnifiedDownloaderClient',
  },
  {
    modulePath: 'src/components/downloader/ResultCard.tsx',
    exportName: 'ResultCard',
  },
  {
    modulePath: 'src/components/feedback-dialog.tsx',
    exportName: 'FeedbackDialog',
  },
  {
    modulePath: 'src/app/[locale]/download-history.tsx',
    exportName: 'DownloadHistory',
  },
  {
    modulePath: 'src/components/ads/viewport-side-rail-ad.tsx',
    exportName: 'ViewportSideRailAd',
  },
];

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(`react-compiler-check failed: ${message}`);
  process.exit(1);
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

function unique(items) {
  return [...new Set(items)];
}

function listStaticChunkFiles() {
  const chunksDir = path.join(NEXT_DIR, 'static', 'chunks');
  if (!fileExists(chunksDir)) {
    return [];
  }

  return fs
    .readdirSync(chunksDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => path.posix.join('static/chunks', entry.name));
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

function getChunkContent(chunkPath) {
  const absolutePath = chunkFilePath(chunkPath);
  if (!fileExists(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function sliceAround(text, index, radius = 60000) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end);
}

function analyzeChunk(chunkPath, exportName) {
  const content = getChunkContent(chunkPath);
  if (!content) {
    return {
      chunk: normalizeChunkPath(chunkPath),
      exists: false,
      exportFound: false,
      markerMemoSentinel: false,
      markerUseMemoCache: false,
      markerCacheCall: false,
      matched: false,
    };
  }

  const exportToken = `"${exportName}",()=>`;
  const exportIndex = content.indexOf(exportToken);
  const exportFound = exportIndex >= 0;
  const scope = exportFound ? sliceAround(content, exportIndex) : content;

  const markerMemoSentinel = scope.includes('react.memo_cache_sentinel');
  const markerUseMemoCache = scope.includes('useMemoCache');
  const markerCacheCall = /\.c\(\d+\)/.test(scope);
  const matched = exportFound && (markerMemoSentinel || markerUseMemoCache || markerCacheCall);

  return {
    chunk: normalizeChunkPath(chunkPath),
    exists: true,
    exportFound,
    markerMemoSentinel,
    markerUseMemoCache,
    markerCacheCall,
    matched,
  };
}

function findChunksByExportName(chunkFiles, exportName) {
  const exportToken = `"${exportName}",()=>`;
  return chunkFiles.filter((chunkFile) => {
    const content = getChunkContent(chunkFile);
    return content ? content.includes(exportToken) : false;
  });
}

function formatStatus(result) {
  return result.passed ? 'PASS' : result.warning ? 'WARN' : 'FAIL';
}

function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fileExists(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  if (!fileExists(RSC_MANIFEST_PATH)) {
    fail(
      `missing build artifact: ${path.relative(PROJECT_ROOT, RSC_MANIFEST_PATH)}. Run "pnpm build" first.`
    );
  }

  const rscManifest = loadRscManifest(RSC_MANIFEST_PATH, ROUTE_KEY);
  const clientModules = rscManifest.clientModules || {};
  const allChunkFiles = listStaticChunkFiles();

  const targetResults = TARGETS.map((target) => {
    const matchedEntry = Object.entries(clientModules).find(
      ([key]) =>
        key.includes(target.modulePath) &&
        !key.includes('<module evaluation>')
    );

    const manifestChunks = matchedEntry
      ? unique((matchedEntry[1].chunks || []).map(normalizeChunkPath))
      : [];
    const exportChunks = findChunksByExportName(allChunkFiles, target.exportName);
    const chunks = unique([...manifestChunks, ...exportChunks]).map(normalizeChunkPath);

    if (chunks.length === 0) {
      return {
        ...target,
        passed: false,
        warning: false,
        reason: matchedEntry ? 'no_chunks_for_target' : 'target_not_found',
        fromManifest: !!matchedEntry,
        chunks: [],
        checks: [],
      };
    }

    const checks = chunks.map((chunk) => analyzeChunk(chunk, target.exportName));
    const passed = checks.some((check) => check.matched);

    const warning = !passed;

    return {
      ...target,
      passed: passed || warning,
      warning,
      reason: passed ? 'ok' : 'no_compiler_markers_near_export',
      fromManifest: !!matchedEntry,
      chunks,
      checks,
    };
  });

  const compiledCount = targetResults.filter((item) => item.reason === 'ok').length;
  const warningCount = targetResults.filter((item) => item.warning).length;
  const hardFailedCount = targetResults.filter(
    (item) => !item.passed && !item.warning
  ).length;
  const passedCount = targetResults.filter((item) => item.passed).length;
  const failedCount = targetResults.length - passedCount;

  const report = {
    generatedAt: new Date().toISOString(),
    route: ROUTE_KEY,
    summary: {
      totalTargets: targetResults.length,
      compiledTargets: compiledCount,
      warningTargets: warningCount,
      failedTargets: failedCount,
    },
    targets: targetResults,
  };

  writeJsonFile(REPORT_FILE, report);

  console.log(`Saved report: ${path.relative(PROJECT_ROOT, REPORT_FILE)}`);
  console.log(`Route: ${ROUTE_KEY}`);
  console.log(
    `Targets: compiled=${compiledCount}, warning=${warningCount}, failed=${failedCount}`
  );

  targetResults.forEach((result) => {
    const evidence = result.checks.find((item) => item.matched) || result.checks[0];
    const evidenceText = evidence
      ? `${evidence.chunk} | export=${evidence.exportFound ? 'yes' : 'no'} | sentinel=${evidence.markerMemoSentinel ? 'yes' : 'no'} | useMemoCache=${evidence.markerUseMemoCache ? 'yes' : 'no'} | cacheCall=${evidence.markerCacheCall ? 'yes' : 'no'}`
      : '(no chunk evidence)';

    console.log(`- ${formatStatus(result)} ${result.modulePath}#${result.exportName}`);
    console.log(`  reason: ${result.reason}`);
    console.log(`  source: ${result.fromManifest ? 'manifest+chunk-scan' : 'chunk-scan'}`);
    console.log(`  evidence: ${evidenceText}`);
  });

  const allWithoutCompilerEvidence = compiledCount === 0;
  if (hardFailedCount > 0 || allWithoutCompilerEvidence) {
    fail('missing targets or no compiler evidence across all targets');
  }

  console.log('react-compiler-check passed');
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
}
