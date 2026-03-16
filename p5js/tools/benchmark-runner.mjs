#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_OUT_DIR = path.join(ROOT_DIR, "benchmarks");
const DEFAULT_PRESET = "baseline";
const DEFAULT_PROFILE = "smoke";
const PRESET_ORDER = ["baseline", "abundance", "scarcity", "metabolic_stress"];
const WORKLOAD_PROFILES = {
  smoke: {
    populationSize: 24,
    maxGenerations: 2,
    timeoutMs: 240000,
  },
  balanced: {
    populationSize: 96,
    maxGenerations: 60,
    timeoutMs: 3600000,
  },
  full_200x60: {
    populationSize: 200,
    maxGenerations: 60,
    timeoutMs: 7200000,
  },
  tune_coarse: {
    populationSize: 256,
    maxGenerations: 40,
    timeoutMs: 5400000,
  },
  tune_confirm: {
    populationSize: 256,
    maxGenerations: 80,
    timeoutMs: 10800000,
  },
  tune_final: {
    populationSize: 320,
    maxGenerations: 100,
    timeoutMs: 14400000,
  },
};
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function usage() {
  console.log("Usage: node tools/benchmark-runner.mjs [--preset <name|all>] [--profile <smoke|balanced|full_200x60|tune_coarse|tune_confirm|tune_final>] [--config-file <json>] [--seed-suite <a,b,c>] [--population-size <n>] [--max-generations <n>] [--timeout-ms <n>] [--out-dir <path>]");
}

function parseSeedSuite(rawValue) {
  if (!rawValue) {
    return null;
  }
  const values = rawValue
    .split(",")
    .map((token) => Number.parseInt(token.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length > 0 ? values : null;
}

function loadConfigFile(filePath) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(ROOT_DIR, filePath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid config file: ${absolutePath}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const args = {
    preset: DEFAULT_PRESET,
    profile: DEFAULT_PROFILE,
    outDir: DEFAULT_OUT_DIR,
    configFile: null,
    configPayload: null,
    seedSuite: null,
    populationSize: null,
    maxGenerations: null,
    timeoutMs: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help") {
      usage();
      process.exit(0);
    }
    if (token === "--preset") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --preset.");
      }
      args.preset = value;
      i += 1;
      continue;
    }
    if (token === "--profile") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --profile.");
      }
      args.profile = value;
      i += 1;
      continue;
    }
    if (token === "--config-file") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --config-file.");
      }
      args.configFile = value;
      i += 1;
      continue;
    }
    if (token === "--seed-suite") {
      const value = argv[i + 1];
      const parsed = parseSeedSuite(value || "");
      if (!parsed) {
        throw new Error("Invalid value for --seed-suite.");
      }
      args.seedSuite = parsed;
      i += 1;
      continue;
    }
    if (token === "--out-dir") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --out-dir.");
      }
      args.outDir = path.resolve(ROOT_DIR, value);
      i += 1;
      continue;
    }
    if (token === "--population-size") {
      const value = Number.parseInt(argv[i + 1] || "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Invalid value for --population-size.");
      }
      args.populationSize = value;
      i += 1;
      continue;
    }
    if (token === "--max-generations") {
      const value = Number.parseInt(argv[i + 1] || "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Invalid value for --max-generations.");
      }
      args.maxGenerations = value;
      i += 1;
      continue;
    }
    if (token === "--timeout-ms") {
      const value = Number.parseInt(argv[i + 1] || "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Invalid value for --timeout-ms.");
      }
      args.timeoutMs = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (args.preset !== "all" && !PRESET_ORDER.includes(args.preset)) {
    throw new Error(`Unsupported preset: ${args.preset}`);
  }
  if (!Object.prototype.hasOwnProperty.call(WORKLOAD_PROFILES, args.profile)) {
    throw new Error(`Unsupported profile: ${args.profile}`);
  }
  if (args.configFile) {
    args.configPayload = loadConfigFile(args.configFile);
  }
  return args;
}

function resolveWorkload(args) {
  const profileDefaults = WORKLOAD_PROFILES[args.profile];
  return {
    profileName: args.profile,
    populationSize: args.populationSize ?? profileDefaults.populationSize,
    maxGenerations: args.maxGenerations ?? profileDefaults.maxGenerations,
    timeoutMs: args.timeoutMs ?? profileDefaults.timeoutMs,
  };
}

function buildAutorunOverrides(presetName, workload, args) {
  const payload = args.configPayload || {};
  const rawConfigOverrides =
    payload.configOverrides && typeof payload.configOverrides === "object" && !Array.isArray(payload.configOverrides)
      ? payload.configOverrides
      : Object.fromEntries(
          Object.entries(payload).filter(([key]) => !["presetName", "seedSuite", "populationSize", "maxGenerations"].includes(key))
        );
  const seedSuite = args.seedSuite ?? (Array.isArray(payload.seedSuite) ? payload.seedSuite : null);
  const populationSize =
    args.populationSize ??
    (Number.isFinite(payload.populationSize) && payload.populationSize > 0 ? Math.floor(payload.populationSize) : workload.populationSize);
  const maxGenerations =
    args.maxGenerations ??
    (Number.isFinite(payload.maxGenerations) && payload.maxGenerations > 0 ? Math.floor(payload.maxGenerations) : workload.maxGenerations);
  return {
    presetName,
    configOverrides: { ...rawConfigOverrides, populationSize, maxGenerations },
    seedSuite,
    populationSize,
    maxGenerations,
  };
}

function runNodeScript(relativeScriptPath, args = [], options = {}) {
  const scriptPath = path.join(ROOT_DIR, relativeScriptPath);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: options.captureOutput ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.trim() : "";
    throw new Error(stderr || `Script failed: ${relativeScriptPath}`);
  }
  return result.stdout ?? "";
}

function buildRuntime() {
  runNodeScript(path.join("tools", "build.mjs"));
}

function createTimestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function nowIso() {
  return new Date().toISOString();
}

function createHardwareSnapshot() {
  const cpus = os.cpus();
  return {
    platform: process.platform,
    release: os.release(),
    arch: process.arch,
    cpu_model: cpus.length > 0 ? cpus[0].model : "unknown",
    logical_cores: cpus.length,
    total_memory_bytes: os.totalmem(),
    hostname: os.hostname(),
  };
}

function createResolvedWorkloadRecord(workload) {
  return {
    profile: workload.profileName,
    populationSize: workload.populationSize,
    maxGenerations: workload.maxGenerations,
    timeoutMs: workload.timeoutMs,
  };
}

function createResolvedWorkloadRecordFromAutorun(workload, autorunOverrides) {
  return {
    profile: workload.profileName,
    populationSize: autorunOverrides.populationSize,
    maxGenerations: autorunOverrides.maxGenerations,
    timeoutMs: workload.timeoutMs,
  };
}

function sessionManifestPath(sessionDir) {
  return path.join(sessionDir, "session.json");
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function writeSessionManifest(sessionDir, manifest) {
  writeJson(sessionManifestPath(sessionDir), manifest);
}

function createSessionManifest(sessionTimestamp, sessionDir, presets, workload) {
  return {
    schema_version: 1,
    session_id: sessionTimestamp,
    started_at: nowIso(),
    output_dir: sessionDir,
    profile_name: workload.profileName,
    resolved_workload: createResolvedWorkloadRecord(workload),
    presets,
    seed_suite: null,
    hardware: createHardwareSnapshot(),
    runs: [],
  };
}

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function resolveRequestPath(urlPathname) {
  const rawPath = urlPathname === "/" ? "/index.html" : urlPathname;
  const relativePath = decodeURIComponent(rawPath).replace(/^\/+/, "");
  const normalizedPath = path.normalize(relativePath);
  const resolvedPath = path.resolve(ROOT_DIR, normalizedPath);
  if (!resolvedPath.startsWith(ROOT_DIR)) {
    return null;
  }
  return resolvedPath;
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
      if (requestUrl.pathname === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
      const targetPath = resolveRequestPath(requestUrl.pathname);
      if (!targetPath) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      fs.stat(targetPath, (statError, stats) => {
        if (statError || !stats.isFile()) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": contentTypeFor(targetPath) });
        fs.createReadStream(targetPath).pipe(res);
      });
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to resolve benchmark server address."));
        return;
      }
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function launchBrowser() {
  if (process.platform === "win32") {
    try {
      return await chromium.launch({
        headless: true,
        channel: "msedge",
      });
    }
    catch (error) {
      console.warn(`Falling back to bundled Playwright Chromium: ${error instanceof Error ? error.message : error}`);
    }
  }
  return chromium.launch({ headless: true });
}

function waitFor(condition, timeoutMs, intervalMs = 250) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (condition()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for benchmark exports.`));
      }
    }, intervalMs);
  });
}

async function runPreset(browser, baseUrl, presetName, sessionDir, workload, sessionTimestamp, autorunOverrides) {
  const presetDir = path.join(sessionDir, presetName);
  fs.mkdirSync(presetDir, { recursive: true });
  const exports = [];
  const pageErrors = [];
  const consoleErrors = [];
  const context = await browser.newContext({
    acceptDownloads: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.exposeFunction("__darwinsPondCaptureExportFromPage", async (record) => {
    exports.push(record);
  });
  await page.addInitScript(() => {
    window.__DARWINS_POND_CAPTURE_EXPORT__ = (filename, payload) => {
      return window.__darwinsPondCaptureExportFromPage({ filename, payload });
    };
  });
  await page.addInitScript((overrides) => {
    window.__DARWINS_POND_AUTORUN_OVERRIDES__ = overrides;
  }, autorunOverrides);
  page.on("pageerror", (error) => {
    pageErrors.push(error);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  const params = new URLSearchParams({
    autorun: "benchmark",
    preset: presetName,
  });
  params.set("populationSize", `${autorunOverrides.populationSize}`);
  params.set("maxGenerations", `${autorunOverrides.maxGenerations}`);
  const runUrl = `${baseUrl}/?${params.toString()}`;
  await page.goto(runUrl, { waitUntil: "load" });
  await waitFor(
    () =>
      pageErrors.length > 0 ||
      exports.some((record) => typeof record.filename === "string" && record.filename.startsWith(`benchmark_suite_${presetName}_`)),
    workload.timeoutMs,
  );
  if (pageErrors.length > 0) {
    throw pageErrors[0];
  }
  if (consoleErrors.length > 0) {
    console.warn(`Console errors during ${presetName}:`);
    for (const message of consoleErrors) {
      console.warn(`  ${message}`);
    }
  }
  let suiteFilePath = null;
  let suitePayload = null;
  const resolvedWorkload = createResolvedWorkloadRecordFromAutorun(workload, autorunOverrides);
  for (const record of exports) {
    const payload =
      record.filename.startsWith(`benchmark_suite_${presetName}_`)
        ? {
            ...record.payload,
            workload_profile: workload.profileName,
            resolved_workload: resolvedWorkload,
            session_id: sessionTimestamp,
            autorun_overrides: autorunOverrides,
          }
        : record.payload;
    const targetFile = path.join(presetDir, record.filename);
    writeJson(targetFile, payload);
    if (record.filename.startsWith(`benchmark_suite_${presetName}_`)) {
      suiteFilePath = targetFile;
      suitePayload = payload;
    }
  }
  if (!suiteFilePath) {
    throw new Error(`Missing benchmark suite export for preset ${presetName}.`);
  }
  const reportMarkdown = runNodeScript(path.join("tools", "benchmark-report.mjs"), [suiteFilePath], {
    captureOutput: true,
  });
  const reportPath = path.join(presetDir, "report.md");
  fs.writeFileSync(reportPath, reportMarkdown);
  await context.close();
  return {
    presetName,
    presetDir,
    reportPath,
    suiteFilePath,
    suitePayload,
    exportCount: exports.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const presets = args.preset === "all" ? PRESET_ORDER : [args.preset];
  const workload = resolveWorkload(args);
  const sessionTimestamp = createTimestampLabel();
  const sessionDir = path.join(args.outDir, sessionTimestamp);
  fs.mkdirSync(sessionDir, { recursive: true });
  const manifest = createSessionManifest(sessionTimestamp, sessionDir, presets, workload);
  writeSessionManifest(sessionDir, manifest);

  buildRuntime();

  const serverHandle = await startStaticServer();
  let browser = null;
  try {
    browser = await launchBrowser();
    const results = [];
    for (const presetName of presets) {
      console.log(`Running benchmark preset: ${presetName}`);
      const autorunOverrides = buildAutorunOverrides(presetName, workload, args);
      const result = await runPreset(browser, serverHandle.baseUrl, presetName, sessionDir, workload, sessionTimestamp, autorunOverrides);
      results.push(result);
      if (!manifest.seed_suite && result.suitePayload && Array.isArray(result.suitePayload.seeds)) {
        manifest.seed_suite = result.suitePayload.seeds.slice();
      }
      manifest.runs.push({
        preset_name: result.presetName,
        suite_file: path.relative(sessionDir, result.suiteFilePath),
        report_file: path.relative(sessionDir, result.reportPath),
        export_count: result.exportCount,
      });
      writeSessionManifest(sessionDir, manifest);
      console.log(`Completed ${presetName}: ${result.exportCount} exports -> ${result.presetDir}`);
    }
    manifest.completed_at = nowIso();
    writeSessionManifest(sessionDir, manifest);
    console.log("");
    console.log("Benchmark outputs:");
    console.log(`- session: ${sessionManifestPath(sessionDir)}`);
    for (const result of results) {
      console.log(`- ${result.presetName}: ${result.reportPath}`);
    }
  }
  finally {
    if (browser) {
      await browser.close();
    }
    await new Promise((resolve, reject) => {
      serverHandle.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
