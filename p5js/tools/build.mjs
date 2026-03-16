#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function buildWithTypeScript() {
  const localTsc = path.join(ROOT_DIR, "node_modules", "typescript", "bin", "tsc");
  if (fs.existsSync(localTsc)) {
    run(process.execPath, [localTsc, "-p", "tsconfig.json"]);
    return;
  }
  const command = process.platform === "win32" ? "tsc.cmd" : "tsc";
  run(command, ["-p", "tsconfig.json"]);
}

function syncRuntimeMirror() {
  const distFile = path.join(ROOT_DIR, "dist", "sketch.js");
  const runtimeMirror = path.join(ROOT_DIR, "sketch.js");
  fs.copyFileSync(distFile, runtimeMirror);
}

buildWithTypeScript();
syncRuntimeMirror();
