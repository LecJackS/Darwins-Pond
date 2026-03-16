#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SKETCH_PATH = path.join(ROOT_DIR, "sketch.ts");
const DEFAULT_OUT_DIR = path.join(ROOT_DIR, "tuning");
const ORIGINAL_SKETCH_SNAPSHOT_FILE = "original-sketch.ts";
const RUN_STATE_FILE = "tuning-state.json";
const STAGE_OUTPUT_FILES = {
  stage1: "stage1-leaderboard.json",
  stage2: "stage2-leaderboard.json",
  stage3: "stage3-finalists.json",
};
const TUNER_SEARCH_SEED = 424242;
const COARSE_SEED_SUITE = [1337, 2027, 8191];
const PRESET_NAMES = ["baseline", "abundance", "scarcity", "metabolic_stress"];
const TUNABLE_KEYS = [
  "foodPatchCount",
  "foodPatchMinUnits",
  "foodPatchMaxUnits",
  "foodPatchRegenDelayFrames",
  "foodUnitEnergyReward",
  "foodPatchDormancyThreshold",
  "foodPatchDormancyDelayFrames",
  "foodPatchRecoveryBatchMultiplier",
  "initialEnergy",
  "basalEnergyDrain",
  "visionEnergyCoeff",
  "baseVisionRadius",
  "sizeVisionCoeff",
  "speedVisionCoeff",
];
const PRESET_OVERRIDE_KEYS = [...TUNABLE_KEYS, "speedEnergyCoeff", "sizeEnergyCoeff"];
const SEARCH_SPACE = {
  foodPatchCount: { type: "int", min: 7, max: 11 },
  foodPatchMinUnits: { type: "int", min: 10, max: 16 },
  foodPatchMaxUnits: { type: "int", min: 18, max: 30 },
  foodPatchRegenDelayFrames: { type: "int", min: 24, max: 72 },
  foodUnitEnergyReward: { type: "float", min: 12, max: 20 },
  foodPatchDormancyThreshold: { type: "float", min: 0.08, max: 0.2 },
  foodPatchDormancyDelayFrames: { type: "int", min: 150, max: 300 },
  foodPatchRecoveryBatchMultiplier: { type: "float", min: 1.5, max: 3.5 },
  initialEnergy: { type: "float", min: 140, max: 190 },
  basalEnergyDrain: { type: "float", min: 0.75, max: 1.05 },
  visionEnergyCoeff: { type: "float", min: 0.08, max: 0.22 },
  baseVisionRadius: { type: "float", min: 40, max: 64 },
  sizeVisionCoeff: { type: "float", min: 32, max: 64 },
  speedVisionCoeff: { type: "float", min: 16, max: 48 },
};
const JITTER_SPACE = {
  foodPatchCount: 1,
  foodPatchMinUnits: 2,
  foodPatchMaxUnits: 2,
  foodPatchRegenDelayFrames: 8,
  foodUnitEnergyReward: 2,
  foodPatchDormancyThreshold: 0.03,
  foodPatchDormancyDelayFrames: 60,
  foodPatchRecoveryBatchMultiplier: 0.5,
  initialEnergy: 15,
  basalEnergyDrain: 0.08,
  visionEnergyCoeff: 0.04,
  baseVisionRadius: 8,
  sizeVisionCoeff: 8,
  speedVisionCoeff: 8,
};
const STAGES = {
  calibration: {
    profile: "tune_confirm",
    presets: ["baseline", "abundance"],
  },
  stage1: { profile: "tune_coarse", candidateCount: 20, survivors: 5, seedSuite: COARSE_SEED_SUITE },
  stage2: { profile: "tune_confirm", neighborsPerSurvivor: 3, finalists: 3 },
  stage3: { profile: "tune_final" },
};
const RELAXATION_STEPS = [
  {
    patchEntropyDelta: 0.08,
    topPatchShareDelta: 0.08,
    dormancyCoverageMin: 0.2,
    directionEntropyDelta: 0.05,
    bestFitnessImprovement: 10,
    energyImprovement: 0.5,
  },
  {
    patchEntropyDelta: 0.05,
    topPatchShareDelta: 0.05,
    dormancyCoverageMin: 0.2,
    directionEntropyDelta: 0.05,
    bestFitnessImprovement: 10,
    energyImprovement: 0.5,
  },
  {
    patchEntropyDelta: 0.05,
    topPatchShareDelta: 0.05,
    dormancyCoverageMin: 0.1,
    directionEntropyDelta: 0.03,
    bestFitnessImprovement: 10,
    energyImprovement: 0.5,
  },
  {
    patchEntropyDelta: 0.05,
    topPatchShareDelta: 0.05,
    dormancyCoverageMin: 0.1,
    directionEntropyDelta: 0.03,
    bestFitnessImprovement: 5,
    energyImprovement: 0.25,
  },
];

function usage() {
  console.log("Usage: node tools/tune-params.mjs [--out-dir <path>] [--resume <tuning-dir>] [--resume-latest] [--reuse-calibration <tuning-dir>]");
}

function parseArgs(argv) {
  const args = {
    outDir: DEFAULT_OUT_DIR,
    resumeDir: null,
    resumeLatest: false,
    reuseCalibrationDir: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help") {
      usage();
      process.exit(0);
    }
    if (token === "--out-dir") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --out-dir.");
      }
      args.outDir = path.isAbsolute(value) ? value : path.resolve(ROOT_DIR, value);
      i += 1;
      continue;
    }
    if (token === "--resume") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --resume.");
      }
      if (args.resumeLatest) {
        throw new Error("Use either --resume or --resume-latest, not both.");
      }
      args.resumeDir = path.isAbsolute(value) ? value : path.resolve(ROOT_DIR, value);
      i += 1;
      continue;
    }
    if (token === "--resume-latest") {
      if (args.resumeDir) {
        throw new Error("Use either --resume or --resume-latest, not both.");
      }
      args.resumeLatest = true;
      continue;
    }
    if (token === "--reuse-calibration") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --reuse-calibration.");
      }
      args.reuseCalibrationDir = path.isAbsolute(value) ? value : path.resolve(ROOT_DIR, value);
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function nowIso() {
  return new Date().toISOString();
}

function createTimestampLabel() {
  return nowIso().replace(/[:.]/g, "-");
}

function getStageOutputPath(tuningRoot, stageName) {
  const fileName = STAGE_OUTPUT_FILES[stageName];
  if (!fileName) {
    throw new Error(`Unknown stage name: ${stageName}`);
  }
  return path.join(tuningRoot, fileName);
}

function getRunStatePath(tuningRoot) {
  return path.join(tuningRoot, RUN_STATE_FILE);
}

function getOriginalSketchSnapshotPath(tuningRoot) {
  return path.join(tuningRoot, ORIGINAL_SKETCH_SNAPSHOT_FILE);
}

function comparableSearchArtifact(payload) {
  return {
    tuner_search_seed: payload.tuner_search_seed,
    population_floor: payload.population_floor,
    calibration_profile: payload.calibration_profile,
    workload_profiles: payload.workload_profiles,
    coarse_seed_subset: payload.coarse_seed_subset,
    full_seed_suite: payload.full_seed_suite,
    tuned_keys: payload.tuned_keys,
    search_space: payload.search_space,
    jitter_space: payload.jitter_space,
    relaxation_steps: payload.relaxation_steps,
  };
}

function findLatestDirectory(parentDir) {
  if (!fs.existsSync(parentDir)) {
    return null;
  }
  const directories = fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentDir, entry.name))
    .sort();
  if (directories.length === 0) {
    return null;
  }
  return directories[directories.length - 1];
}

function resolveTuningRoot(args) {
  if (args.resumeDir) {
    return {
      tuningRoot: args.resumeDir,
      resumed: true,
    };
  }
  if (args.resumeLatest) {
    const latestDir = findLatestDirectory(args.outDir);
    if (!latestDir) {
      throw new Error(`No tuning directory found under ${args.outDir}`);
    }
    return {
      tuningRoot: latestDir,
      resumed: true,
    };
  }
  return {
    tuningRoot: path.join(args.outDir, createTimestampLabel()),
    resumed: false,
  };
}

function loadRunState(tuningRoot) {
  return readJsonIfExists(getRunStatePath(tuningRoot));
}

function updateRunState(tuningRoot, patch) {
  const current = loadRunState(tuningRoot) || {};
  const next = {
    ...current,
    ...patch,
    updated_at: nowIso(),
  };
  if (!next.created_at) {
    next.created_at = nowIso();
  }
  writeJson(getRunStatePath(tuningRoot), next);
  return next;
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return readJson(filePath);
}

function clampNumber(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function clamp01(value) {
  return clampNumber(value, 0, 1);
}

function round4(value) {
  return Math.round(value * 10000) / 10000;
}

function meanOf(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
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

function createRng(seed) {
  let state = (Math.floor(seed) >>> 0) || 1;
  return {
    nextFloat() {
      let x = state >>> 0;
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x >>>= 0;
      x ^= x << 5;
      x >>>= 0;
      state = x === 0 ? 1 : x;
      return (state >>> 0) / 4294967296;
    },
    range(minValue, maxValue) {
      if (maxValue <= minValue) {
        return minValue;
      }
      return minValue + this.nextFloat() * (maxValue - minValue);
    },
    int(minValue, maxValue) {
      if (maxValue <= minValue) {
        return minValue;
      }
      return Math.floor(this.range(minValue, maxValue + 1));
    },
  };
}

function extractLiteralByPrefix(source, prefix) {
  const prefixIndex = source.indexOf(prefix);
  if (prefixIndex === -1) {
    throw new Error(`Could not find source prefix: ${prefix}`);
  }
  let startIndex = -1;
  for (let i = prefixIndex + prefix.length; i < source.length; i += 1) {
    const char = source[i];
    if (char === "{" || char === "[") {
      startIndex = i;
      break;
    }
  }
  if (startIndex === -1) {
    throw new Error(`Could not find literal start for prefix: ${prefix}`);
  }
  const stack = [source[startIndex]];
  let inString = false;
  let stringQuote = "";
  let escaped = false;
  for (let i = startIndex + 1; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
        stringQuote = "";
      }
      continue;
    }
    if (char === "'" || char === "\"" || char === "`") {
      inString = true;
      stringQuote = char;
      continue;
    }
    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }
    if (char === "}" || char === "]") {
      const opener = stack.pop();
      const expectedCloser = opener === "{" ? "}" : "]";
      if (char !== expectedCloser) {
        throw new Error(`Mismatched literal delimiters while parsing ${prefix}`);
      }
      if (stack.length === 0) {
        return source.slice(startIndex, i + 1);
      }
    }
  }
  throw new Error(`Unterminated literal for prefix: ${prefix}`);
}

function evaluateLiteral(literal) {
  return Function(`"use strict"; return (${literal});`)();
}

function loadSketchModel() {
  const source = fs.readFileSync(SKETCH_PATH, "utf8");
  const baseConfig = evaluateLiteral(extractLiteralByPrefix(source, "const BASE_SIM_CONFIG = "));
  const experimentPresets = evaluateLiteral(extractLiteralByPrefix(source, "const EXPERIMENT_PRESETS = "));
  const benchmarkSeedSuite = evaluateLiteral(extractLiteralByPrefix(source, "const BENCHMARK_SEED_SUITE = "));
  return {
    source,
    baseConfig,
    experimentPresets,
    benchmarkSeedSuite,
  };
}

function pickTunables(config) {
  const out = {};
  for (const key of TUNABLE_KEYS) {
    out[key] = config[key];
  }
  return out;
}

function candidateSignature(candidate) {
  return JSON.stringify(TUNABLE_KEYS.map((key) => candidate[key]));
}

function normalizeTunableValues(values, baseConfig, clampToSearchSpace) {
  const normalized = { ...values };
  normalized.foodPatchCount = Math.max(1, Math.floor(normalized.foodPatchCount));
  normalized.foodPatchMinUnits = Math.max(1, Math.floor(normalized.foodPatchMinUnits));
  normalized.foodPatchMaxUnits = Math.max(normalized.foodPatchMinUnits + 6, Math.floor(normalized.foodPatchMaxUnits));
  normalized.foodPatchRegenDelayFrames = Math.max(1, Math.floor(normalized.foodPatchRegenDelayFrames));
  normalized.foodUnitEnergyReward = round4(clampNumber(normalized.foodUnitEnergyReward, 0, 10000));
  normalized.foodPatchDormancyThreshold = round4(clampNumber(normalized.foodPatchDormancyThreshold, 0, 1));
  normalized.foodPatchDormancyDelayFrames = Math.max(1, Math.floor(normalized.foodPatchDormancyDelayFrames));
  normalized.foodPatchRecoveryBatchMultiplier = round4(clampNumber(normalized.foodPatchRecoveryBatchMultiplier, 1, 1000));
  normalized.initialEnergy = round4(clampNumber(normalized.initialEnergy, 1, baseConfig.maxEnergy));
  normalized.basalEnergyDrain = round4(clampNumber(normalized.basalEnergyDrain, 0, 1000));
  normalized.visionEnergyCoeff = round4(clampNumber(normalized.visionEnergyCoeff, 0, 1000));
  normalized.baseVisionRadius = round4(clampNumber(normalized.baseVisionRadius, 1, baseConfig.maxVisionRadius));
  normalized.sizeVisionCoeff = round4(clampNumber(normalized.sizeVisionCoeff, 0, 10000));
  normalized.speedVisionCoeff = round4(clampNumber(normalized.speedVisionCoeff, 0, 10000));
  if (clampToSearchSpace) {
    for (const key of TUNABLE_KEYS) {
      const spec = SEARCH_SPACE[key];
      if (!spec) {
        continue;
      }
      if (spec.type === "int") {
        normalized[key] = clampNumber(Math.floor(normalized[key]), spec.min, spec.max);
      } else {
        normalized[key] = round4(clampNumber(normalized[key], spec.min, spec.max));
      }
    }
    normalized.foodPatchMaxUnits = Math.max(normalized.foodPatchMinUnits + 6, normalized.foodPatchMaxUnits);
  }
  return normalized;
}

function normalizeCandidate(candidate, baseConfig) {
  return normalizeTunableValues({ ...pickTunables(baseConfig), ...candidate }, baseConfig, true);
}

function normalizePresetOverrides(overrides, baseConfig) {
  return normalizeTunableValues({ ...pickTunables(baseConfig), ...overrides }, baseConfig, false);
}

function createRandomCandidate(rng, baseConfig) {
  const candidate = {};
  for (const key of TUNABLE_KEYS) {
    const spec = SEARCH_SPACE[key];
    if (spec.type === "int") {
      candidate[key] = rng.int(spec.min, spec.max);
    } else {
      candidate[key] = round4(rng.range(spec.min, spec.max));
    }
  }
  return normalizeCandidate(candidate, baseConfig);
}

function jitterCandidate(baseCandidate, rng, baseConfig) {
  const candidate = { ...baseCandidate };
  for (const key of TUNABLE_KEYS) {
    const amplitude = JITTER_SPACE[key];
    if (amplitude === undefined) {
      continue;
    }
    const spec = SEARCH_SPACE[key];
    if (spec.type === "int") {
      candidate[key] = candidate[key] + rng.int(-amplitude, amplitude);
    } else {
      candidate[key] = candidate[key] + rng.range(-amplitude, amplitude);
    }
  }
  return normalizeCandidate(candidate, baseConfig);
}

function createStage1Candidates(baseConfig, baselineReference) {
  const rng = createRng(TUNER_SEARCH_SEED);
  const seen = new Set();
  const candidates = [];
  const referenceCandidate = normalizeCandidate(baselineReference, baseConfig);
  candidates.push({
    id: "stage1_001_current_baseline",
    config: referenceCandidate,
  });
  seen.add(candidateSignature(referenceCandidate));
  while (candidates.length < STAGES.stage1.candidateCount) {
    const candidate = createRandomCandidate(rng, baseConfig);
    const signature = candidateSignature(candidate);
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    candidates.push({
      id: `stage1_${String(candidates.length + 1).padStart(3, "0")}`,
      config: candidate,
    });
  }
  return candidates;
}

function createStage2Candidates(stage1Ranked, baseConfig) {
  const rng = createRng(TUNER_SEARCH_SEED ^ 0x9e3779b9);
  const seen = new Set();
  const candidates = [];
  const survivors = stage1Ranked.slice(0, STAGES.stage1.survivors);
  const targetCount = STAGES.stage1.survivors * (STAGES.stage2.neighborsPerSurvivor + 1);
  for (let survivorIndex = 0; survivorIndex < survivors.length; survivorIndex += 1) {
    const survivor = survivors[survivorIndex];
    const survivorConfig = normalizeCandidate(survivor.config, baseConfig);
    const survivorSignature = candidateSignature(survivorConfig);
    if (!seen.has(survivorSignature)) {
      seen.add(survivorSignature);
      candidates.push({
        id: `stage2_${String(candidates.length + 1).padStart(3, "0")}_seed`,
        source: survivor.id,
        config: survivorConfig,
      });
    }
    let neighborsAdded = 0;
    let attempts = 0;
    while (neighborsAdded < STAGES.stage2.neighborsPerSurvivor && attempts < 128) {
      attempts += 1;
      const neighbor = jitterCandidate(survivorConfig, rng, baseConfig);
      const signature = candidateSignature(neighbor);
      if (seen.has(signature)) {
        continue;
      }
      seen.add(signature);
      candidates.push({
        id: `stage2_${String(candidates.length + 1).padStart(3, "0")}_neighbor`,
        source: survivor.id,
        config: neighbor,
      });
      neighborsAdded += 1;
    }
  }
  let refillAttempts = 0;
  while (candidates.length < targetCount && refillAttempts < 256) {
    refillAttempts += 1;
    const survivor = survivors[rng.int(0, survivors.length - 1)];
    const refillCandidate = jitterCandidate(survivor.config, rng, baseConfig);
    const signature = candidateSignature(refillCandidate);
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    candidates.push({
      id: `stage2_${String(candidates.length + 1).padStart(3, "0")}_refill`,
      source: survivor.id,
      config: refillCandidate,
    });
  }
  return candidates.slice(0, targetCount);
}

function createStage3Candidates(stage2Ranked) {
  return stage2Ranked.slice(0, STAGES.stage2.finalists).map((candidate, index) => ({
    id: `stage3_${String(index + 1).padStart(3, "0")}_finalist`,
    source: candidate.id,
    config: { ...candidate.config },
  }));
}

function findSingleSessionDir(parentDir) {
  const directories = fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentDir, entry.name))
    .sort();
  if (directories.length === 0) {
    throw new Error(`No benchmark session directory found in ${parentDir}`);
  }
  return directories[directories.length - 1];
}

function findLatestValidSession(parentDir, expectedRunCount) {
  if (!fs.existsSync(parentDir)) {
    return null;
  }
  const directories = fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parentDir, entry.name))
    .sort()
    .reverse();
  for (const sessionDir of directories) {
    const manifestPath = path.join(sessionDir, "session.json");
    if (!fs.existsSync(manifestPath)) {
      continue;
    }
    const sessionManifest = readJson(manifestPath);
    if (!Array.isArray(sessionManifest.runs) || sessionManifest.runs.length !== expectedRunCount) {
      continue;
    }
    let allRunsPresent = true;
    for (const runRecord of sessionManifest.runs) {
      const suitePath = path.join(sessionDir, runRecord.suite_file || "");
      if (!runRecord.suite_file || !fs.existsSync(suitePath)) {
        allRunsPresent = false;
        break;
      }
    }
    if (!allRunsPresent) {
      continue;
    }
    return {
      sessionDir,
      sessionManifest,
    };
  }
  return null;
}

function ensureCandidateConfig(candidateDir, candidate) {
  const configFilePath = path.join(candidateDir, "candidate-config.json");
  const nextPayload = {
    configOverrides: candidate.config,
  };
  const existingPayload = readJsonIfExists(configFilePath);
  if (existingPayload) {
    const existingSignature = candidateSignature(existingPayload.configOverrides || {});
    const nextSignature = candidateSignature(candidate.config);
    if (existingSignature !== nextSignature) {
      throw new Error(`Candidate config mismatch for ${candidate.id} in ${candidateDir}`);
    }
  } else {
    writeJson(configFilePath, nextPayload);
  }
  return configFilePath;
}

function tryReuseCandidateRun(candidateDir, candidate) {
  ensureCandidateConfig(candidateDir, candidate);
  const existingSession = findLatestValidSession(candidateDir, 1);
  if (!existingSession) {
    return null;
  }
  const runRecord = existingSession.sessionManifest.runs[0];
  const suiteFilePath = path.join(existingSession.sessionDir, runRecord.suite_file);
  return {
    candidateDir,
    sessionDir: existingSession.sessionDir,
    suiteFilePath,
    suitePayload: readJson(suiteFilePath),
    reused: true,
  };
}

function runBenchmarkForCandidate(stageDir, candidate, profileName, seedSuite) {
  const candidateDir = path.join(stageDir, candidate.id);
  fs.mkdirSync(candidateDir, { recursive: true });
  const configFilePath = ensureCandidateConfig(candidateDir, candidate);
  const cachedRun = tryReuseCandidateRun(candidateDir, candidate);
  if (cachedRun) {
    return cachedRun;
  }
  runNodeScript(
    path.join("tools", "benchmark-runner.mjs"),
    [
      "--preset",
      "baseline",
      "--profile",
      profileName,
      "--out-dir",
      candidateDir,
      "--config-file",
      configFilePath,
      "--seed-suite",
      seedSuite.join(","),
    ]
  );
  const sessionDir = findSingleSessionDir(candidateDir);
  const sessionManifest = JSON.parse(fs.readFileSync(path.join(sessionDir, "session.json"), "utf8"));
  if (!Array.isArray(sessionManifest.runs) || sessionManifest.runs.length !== 1) {
    throw new Error(`Unexpected benchmark session layout for ${candidate.id}`);
  }
  const suiteFilePath = path.join(sessionDir, sessionManifest.runs[0].suite_file);
  const suitePayload = JSON.parse(fs.readFileSync(suiteFilePath, "utf8"));
  return {
    candidateDir,
    sessionDir,
    suiteFilePath,
    suitePayload,
    reused: false,
  };
}

function aggregateSuiteMetrics(suitePayload) {
  const entries = Array.isArray(suitePayload.entries) ? suitePayload.entries : [];
  if (entries.length === 0) {
    throw new Error("Benchmark suite payload has no entries.");
  }
  const averageEntryMetric = (key, fallbackKey = null) =>
    round4(
      meanOf(
        entries.map((entry) => {
          if (Number.isFinite(entry[key])) {
            return entry[key];
          }
          if (fallbackKey && Number.isFinite(entry[fallbackKey])) {
            return entry[fallbackKey];
          }
          return 0;
        })
      )
    );
  return {
    populationSize:
      suitePayload.resolved_workload && Number.isFinite(suitePayload.resolved_workload.populationSize)
        ? suitePayload.resolved_workload.populationSize
        : suitePayload.config.populationSize,
    maxGenerations:
      suitePayload.resolved_workload && Number.isFinite(suitePayload.resolved_workload.maxGenerations)
        ? suitePayload.resolved_workload.maxGenerations
        : suitePayload.config.maxGenerations,
    seedCount: entries.length,
    bestFitnessAvg: averageEntryMetric("bestFitness"),
    meanEnergyAvg: averageEntryMetric("meanEnergyRemaining"),
    starvationRatioAvg: averageEntryMetric("starvationRatio"),
    patchEntropyAvg: averageEntryMetric("patchConsumptionEntropy"),
    topPatchShareAvg: averageEntryMetric("topPatchConsumptionShare"),
    patchDormantCountAvg: averageEntryMetric("patchDormantCount"),
    patchTurnoverRateAvg: averageEntryMetric("patchTurnoverRate"),
    meanVisionRadiusAvg: averageEntryMetric("meanVisionRadius"),
    visionRadiusStdDevAvg: averageEntryMetric("visionRadiusStdDev"),
    directionChoiceEntropyAvg: averageEntryMetric("directionChoiceEntropy"),
    meanObservedFoodDensityAvg: averageEntryMetric("meanObservedFoodDensity"),
    meanObservedAgentDensityAvg: averageEntryMetric("meanObservedAgentDensity"),
    speedTraitStdDevAvg: averageEntryMetric("speedTraitStdDev"),
    sizeTraitStdDevAvg: averageEntryMetric("sizeTraitStdDev"),
    meanNearestPatchDistanceAvg: averageEntryMetric("meanNearestPatchDistance"),
    tailWindowGenerationsAvg: averageEntryMetric("tailWindowGenerations"),
    bestFitnessTailAvg: averageEntryMetric("bestFitnessTailAvg", "bestFitness"),
    meanEnergyTailAvg: averageEntryMetric("meanEnergyTailAvg", "meanEnergyRemaining"),
    starvationRatioTailAvg: averageEntryMetric("starvationRatioTailAvg", "starvationRatio"),
    patchEntropyTailAvg: averageEntryMetric("patchEntropyTailAvg", "patchConsumptionEntropy"),
    topPatchShareTailAvg: averageEntryMetric("topPatchShareTailAvg", "topPatchConsumptionShare"),
    patchTurnoverRateTailAvg: averageEntryMetric("patchTurnoverRateTailAvg", "patchTurnoverRate"),
    meanVisionRadiusTailAvg: averageEntryMetric("meanVisionRadiusTailAvg", "meanVisionRadius"),
    visionRadiusStdDevTailAvg: averageEntryMetric("visionRadiusStdDevTailAvg", "visionRadiusStdDev"),
    directionChoiceEntropyTailAvg: averageEntryMetric("directionChoiceEntropyTailAvg", "directionChoiceEntropy"),
    meanObservedFoodDensityTailAvg: averageEntryMetric("meanObservedFoodDensityTailAvg", "meanObservedFoodDensity"),
    meanObservedAgentDensityTailAvg: averageEntryMetric("meanObservedAgentDensityTailAvg", "meanObservedAgentDensity"),
    speedTraitStdDevTailAvg: averageEntryMetric("speedTraitStdDevTailAvg", "speedTraitStdDev"),
    sizeTraitStdDevTailAvg: averageEntryMetric("sizeTraitStdDevTailAvg", "sizeTraitStdDev"),
    relocationCoverage: round4(
      meanOf(entries.map((entry) => (entry.relocatedDuringRun || (entry.patchRelocatedCount || 0) > 0 ? 1 : 0)))
    ),
    dormancyCoverage: round4(
      meanOf(entries.map((entry) => (entry.dormantDuringRun || (entry.patchDormantCount || 0) > 0 ? 1 : 0)))
    ),
  };
}

function getRelaxationStep(relaxationLevel) {
  return RELAXATION_STEPS[Math.min(relaxationLevel, RELAXATION_STEPS.length - 1)];
}

function clampTarget(value, low, high) {
  const orderedLow = Math.min(low, high);
  const orderedHigh = Math.max(low, high);
  return clampNumber(value, orderedLow, orderedHigh);
}

function buildCalibrationTargets(calibration, relaxationLevel) {
  const step = getRelaxationStep(relaxationLevel);
  const baseline = calibration.baseline;
  const abundance = calibration.abundance;
  const starvationLowerBound = clampNumber(Math.max(abundance.starvationRatioTailAvg + 0.07, 0.35), 0, 0.98);
  let starvationUpperBound = clampNumber(Math.min(baseline.starvationRatioTailAvg - 0.05, 0.95), 0, 0.98);
  if (starvationUpperBound < starvationLowerBound) {
    starvationUpperBound = clampNumber(starvationLowerBound + 0.05, starvationLowerBound, 0.98);
  }
  return {
    relaxationLevel,
    step,
    starvationLowerBound,
    starvationUpperBound,
    patchEntropyMin: Math.max(baseline.patchEntropyTailAvg + step.patchEntropyDelta, 0.35),
    topPatchShareMax: clampNumber(Math.min(baseline.topPatchShareTailAvg - step.topPatchShareDelta, 0.85), 0.2, 0.85),
    directionChoiceEntropyMin: Math.max(baseline.directionChoiceEntropyTailAvg + step.directionEntropyDelta, 0.45),
    meanEnergyMin: Math.max(baseline.meanEnergyTailAvg + step.energyImprovement, 1),
    bestFitnessMin: baseline.bestFitnessTailAvg + step.bestFitnessImprovement,
    targetStarvation: clampTarget(baseline.starvationRatioTailAvg - 0.1, starvationLowerBound + 0.05, 0.8),
    targetTurnover: Math.max(baseline.patchTurnoverRateTailAvg + 0.05, 0.15),
    targetEnergy: clampTarget(baseline.meanEnergyTailAvg + 1.5, 2, 10),
    baselineObservedFoodDensity: baseline.meanObservedFoodDensityTailAvg,
  };
}

function passesHardGates(metrics, targets) {
  return (
    metrics.populationSize >= 256 &&
    metrics.starvationRatioTailAvg >= targets.starvationLowerBound &&
    metrics.starvationRatioTailAvg <= targets.starvationUpperBound &&
    metrics.bestFitnessTailAvg >= targets.bestFitnessMin &&
    metrics.patchEntropyTailAvg >= targets.patchEntropyMin &&
    metrics.topPatchShareTailAvg <= targets.topPatchShareMax &&
    metrics.directionChoiceEntropyTailAvg >= targets.directionChoiceEntropyMin &&
    metrics.meanEnergyTailAvg >= targets.meanEnergyMin &&
    metrics.relocationCoverage >= 0.6 &&
    metrics.dormancyCoverage >= targets.step.dormancyCoverageMin &&
    metrics.speedTraitStdDevTailAvg >= 0.15 &&
    metrics.sizeTraitStdDevTailAvg >= 0.15 &&
    metrics.visionRadiusStdDevTailAvg >= 0.1
  );
}

function computeScore(metrics, targets) {
  const survivalBalance = clamp01(1 - Math.abs(metrics.starvationRatioTailAvg - targets.targetStarvation) / 0.2);
  const competitionSpread =
    0.5 * clamp01(1 - Math.abs(metrics.topPatchShareTailAvg - 0.6) / 0.25) +
    0.5 * clamp01(metrics.patchEntropyTailAvg / 0.75);
  const renewability =
    0.5 * clamp01(metrics.dormancyCoverage / 0.5) +
    0.5 * clamp01(1 - Math.abs(metrics.patchTurnoverRateTailAvg - targets.targetTurnover) / 0.15);
  const observedFoodImprovement = clamp01(
    (metrics.meanObservedFoodDensityTailAvg - targets.baselineObservedFoodDensity + 0.12) / 0.24
  );
  const sensorUse =
    0.5 * clamp01(metrics.directionChoiceEntropyTailAvg / 0.75) +
    0.5 * observedFoodImprovement;
  const traitDiversity =
    (clamp01(metrics.speedTraitStdDevTailAvg / 0.35) +
      clamp01(metrics.sizeTraitStdDevTailAvg / 0.35) +
      clamp01(metrics.visionRadiusStdDevTailAvg / 12)) /
    3;
  const energyBalance = clamp01(1 - Math.abs(metrics.meanEnergyTailAvg - targets.targetEnergy) / Math.max(1, targets.targetEnergy));
  const totalScore =
    0.28 * survivalBalance +
    0.24 * competitionSpread +
    0.16 * renewability +
    0.12 * sensorUse +
    0.1 * traitDiversity +
    0.1 * energyBalance;
  return {
    survivalBalance: round4(survivalBalance),
    competitionSpread: round4(competitionSpread),
    renewability: round4(renewability),
    sensorUse: round4(sensorUse),
    traitDiversity: round4(traitDiversity),
    energyBalance: round4(energyBalance),
    totalScore: round4(totalScore),
  };
}

function rankCandidates(stageName, evaluations, calibration) {
  let relaxationLevel = 0;
  let gatePassing = [];
  let activeTargets = buildCalibrationTargets(calibration, relaxationLevel);
  while (relaxationLevel < RELAXATION_STEPS.length) {
    activeTargets = buildCalibrationTargets(calibration, relaxationLevel);
    gatePassing = evaluations.filter((evaluation) => passesHardGates(evaluation.metrics, activeTargets));
    if (gatePassing.length > 0) {
      break;
    }
    relaxationLevel += 1;
  }
  const usedFallback = gatePassing.length === 0;
  const targets = buildCalibrationTargets(calibration, Math.min(relaxationLevel, RELAXATION_STEPS.length - 1));
  const enriched = evaluations.map((evaluation) => ({
    ...evaluation,
    score: computeScore(evaluation.metrics, targets),
  }));
  const passSet = new Set(gatePassing.map((evaluation) => evaluation.id));
  const rankingBase = (usedFallback ? enriched.slice() : enriched.filter((evaluation) => passSet.has(evaluation.id))).sort((left, right) => {
    if (right.score.totalScore !== left.score.totalScore) {
      return right.score.totalScore - left.score.totalScore;
    }
    if (right.score.competitionSpread !== left.score.competitionSpread) {
      return right.score.competitionSpread - left.score.competitionSpread;
    }
    if (right.score.renewability !== left.score.renewability) {
      return right.score.renewability - left.score.renewability;
    }
    if (left.metrics.topPatchShareTailAvg !== right.metrics.topPatchShareTailAvg) {
      return left.metrics.topPatchShareTailAvg - right.metrics.topPatchShareTailAvg;
    }
    return left.id.localeCompare(right.id);
  });
  const allRanked = enriched
    .map((evaluation) => ({
      ...evaluation,
      passesCurrentGates: passSet.has(evaluation.id),
      relaxationLevelUsed: Math.min(relaxationLevel, RELAXATION_STEPS.length - 1),
    }))
    .sort((left, right) => {
      if (Number(right.passesCurrentGates) !== Number(left.passesCurrentGates)) {
        return Number(right.passesCurrentGates) - Number(left.passesCurrentGates);
      }
      if (right.score.totalScore !== left.score.totalScore) {
        return right.score.totalScore - left.score.totalScore;
      }
      if (right.score.competitionSpread !== left.score.competitionSpread) {
        return right.score.competitionSpread - left.score.competitionSpread;
      }
      if (right.score.renewability !== left.score.renewability) {
        return right.score.renewability - left.score.renewability;
      }
      return left.metrics.topPatchShareTailAvg - right.metrics.topPatchShareTailAvg;
    });
  return {
    stage: stageName,
    relaxationLevelUsed: Math.min(relaxationLevel, RELAXATION_STEPS.length - 1),
    usedFallback,
    scoringTargets: targets,
    rankedForSelection: rankingBase,
    leaderboard: allRanked,
  };
}

function finalizePresetOverrides(overrides, baseConfig) {
  const normalized = normalizePresetOverrides(overrides, baseConfig);
  if (overrides.speedEnergyCoeff !== undefined) {
    normalized.speedEnergyCoeff = round4(clampNumber(overrides.speedEnergyCoeff, 0, 1000));
  }
  if (overrides.sizeEnergyCoeff !== undefined) {
    normalized.sizeEnergyCoeff = round4(clampNumber(overrides.sizeEnergyCoeff, 0, 1000));
  }
  return orderPresetObject(normalized);
}

function derivePresetOverrides(winnerConfig, baseConfig) {
  const baseline = finalizePresetOverrides(winnerConfig, baseConfig);
  const baselineFull = {
    ...baseConfig,
    ...baseline,
  };

  const abundance = finalizePresetOverrides(
    {
      ...baseline,
      foodPatchCount: baseline.foodPatchCount + 2,
      foodPatchMinUnits: Math.round(baseline.foodPatchMinUnits * 1.25),
      foodPatchMaxUnits: Math.round(baseline.foodPatchMaxUnits * 1.3),
      foodPatchRegenDelayFrames: Math.round(baseline.foodPatchRegenDelayFrames * 0.67),
      foodUnitEnergyReward: baseline.foodUnitEnergyReward * 1.05,
      basalEnergyDrain: baseline.basalEnergyDrain * 0.98,
      speedEnergyCoeff: baselineFull.speedEnergyCoeff * 0.85,
      sizeEnergyCoeff: baselineFull.sizeEnergyCoeff * 0.8,
    },
    baseConfig
  );

  const scarcity = finalizePresetOverrides(
    {
      ...baseline,
      foodPatchCount: Math.max(4, baseline.foodPatchCount - 2),
      foodPatchMinUnits: Math.round(baseline.foodPatchMinUnits * 0.75),
      foodPatchMaxUnits: Math.round(baseline.foodPatchMaxUnits * 0.75),
      foodPatchRegenDelayFrames: Math.round(baseline.foodPatchRegenDelayFrames * 1.5),
      foodUnitEnergyReward: baseline.foodUnitEnergyReward * 1.15,
      basalEnergyDrain: baseline.basalEnergyDrain * 1.1,
      speedEnergyCoeff: baselineFull.speedEnergyCoeff * 1.1,
      sizeEnergyCoeff: baselineFull.sizeEnergyCoeff * 1.2,
    },
    baseConfig
  );

  const metabolicStress = finalizePresetOverrides(
    {
      ...baseline,
      foodPatchCount: baseline.foodPatchCount,
      foodPatchMinUnits: Math.round(baseline.foodPatchMinUnits * 0.85),
      foodPatchMaxUnits: Math.round(baseline.foodPatchMaxUnits * 0.85),
      foodPatchRegenDelayFrames: Math.round(baseline.foodPatchRegenDelayFrames * 1.33),
      basalEnergyDrain: baseline.basalEnergyDrain * 1.25,
      speedEnergyCoeff: baselineFull.speedEnergyCoeff * 1.2,
      sizeEnergyCoeff: baselineFull.sizeEnergyCoeff * 1.25,
    },
    baseConfig
  );

  return {
    baseline,
    abundance,
    scarcity,
    metabolic_stress: metabolicStress,
  };
}

function orderPresetObject(preset) {
  const ordered = {};
  for (const key of PRESET_OVERRIDE_KEYS) {
    if (preset[key] !== undefined) {
      ordered[key] = preset[key];
    }
  }
  return ordered;
}

function replaceExperimentPresetsBlock(source, presetOverrides) {
  const blockStart = source.indexOf("const EXPERIMENT_PRESETS = ");
  if (blockStart === -1) {
    throw new Error("Could not find EXPERIMENT_PRESETS block.");
  }
  const blockEndMarker = "\nconst PRESET_NAMES = Object.keys(EXPERIMENT_PRESETS);";
  const blockEnd = source.indexOf(blockEndMarker, blockStart);
  if (blockEnd === -1) {
    throw new Error("Could not find EXPERIMENT_PRESETS block end.");
  }
  const replacement = `const EXPERIMENT_PRESETS = ${JSON.stringify(presetOverrides, null, 4)};`;
  return `${source.slice(0, blockStart)}${replacement}${source.slice(blockEnd)}`;
}

function writeMarkdownSummary(filePath, payload) {
  const lines = [];
  lines.push("# Tuning Summary");
  lines.push("");
  lines.push(`Generated: ${payload.generatedAt}`);
  lines.push("");
  lines.push("## Calibration");
  lines.push("");
  lines.push("### baseline");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(payload.calibration.baseline, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("### abundance");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(payload.calibration.abundance, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Winner");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(payload.winner.config, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Winner Metrics");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(payload.winner.metrics, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Stage Best Scores");
  lines.push("");
  for (const stage of payload.stageScores) {
    lines.push(`- ${stage.stage}: ${stage.bestScore}`);
  }
  lines.push("");
  lines.push("## Preset Ordering");
  lines.push("");
  for (const check of payload.validation.full_preset_validation.ordering.checks) {
    lines.push(`- [${check.passed ? "x" : " "}] ${check.name}`);
  }
  lines.push("");
  lines.push("## Full Validation Metrics");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(payload.validation.full_preset_validation.metricsByPreset, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Baseline Confirmation");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(payload.validation.baseline_confirmation.metrics, null, 2));
  lines.push("```");
  fs.writeFileSync(filePath, lines.join("\n"));
}

function validatePresetOrdering(metricsByPreset) {
  const abundance = metricsByPreset.abundance;
  const baseline = metricsByPreset.baseline;
  const scarcity = metricsByPreset.scarcity;
  const metabolicStress = metricsByPreset.metabolic_stress;
  const checks = [
    {
      name: "abundance tail starvation ratio is below baseline",
      passed: abundance.starvationRatioTailAvg < baseline.starvationRatioTailAvg,
    },
    {
      name: "abundance tail mean energy is above baseline",
      passed: abundance.meanEnergyTailAvg > baseline.meanEnergyTailAvg,
    },
    {
      name: "scarcity tail starvation ratio is above baseline",
      passed: scarcity.starvationRatioTailAvg > baseline.starvationRatioTailAvg,
    },
    {
      name: "metabolic stress is harder than scarcity or clearly below baseline tail fitness",
      passed:
        metabolicStress.starvationRatioTailAvg >= scarcity.starvationRatioTailAvg ||
        metabolicStress.bestFitnessTailAvg < baseline.bestFitnessTailAvg - 15,
    },
    ...PRESET_NAMES.map((presetName) => ({
      name: `${presetName} tail patch entropy stays above 0.35`,
      passed: metricsByPreset[presetName].patchEntropyTailAvg >= 0.35,
    })),
    ...PRESET_NAMES.map((presetName) => ({
      name: `${presetName} tail top patch share stays at or below 0.90`,
      passed: metricsByPreset[presetName].topPatchShareTailAvg <= 0.9,
    })),
    ...PRESET_NAMES.map((presetName) => ({
      name: `${presetName} tail direction choice entropy stays above 0.40`,
      passed: metricsByPreset[presetName].directionChoiceEntropyTailAvg >= 0.4,
    })),
  ];
  return {
    checks,
    passed: checks.every((check) => check.passed),
  };
}

function readSingleRunSuite(sessionDir) {
  const sessionManifest = readJson(sessionManifestPath(sessionDir));
  if (!Array.isArray(sessionManifest.runs) || sessionManifest.runs.length !== 1) {
    throw new Error(`Unexpected benchmark session layout in ${sessionDir}`);
  }
  const runRecord = sessionManifest.runs[0];
  const suiteFilePath = path.join(sessionDir, runRecord.suite_file);
  const suitePayload = readJson(suiteFilePath);
  return {
    sessionDir,
    sessionManifest,
    runRecord,
    suiteFilePath,
    suitePayload,
  };
}

function tryReuseSinglePresetBenchmark(targetDir) {
  const existingSession = findLatestValidSession(targetDir, 1);
  if (!existingSession) {
    return null;
  }
  const session = readSingleRunSuite(existingSession.sessionDir);
  return {
    ...session,
    reused: true,
  };
}

function runSinglePresetBenchmark(targetDir, presetName, profileName, seedSuite, configFilePath = null) {
  fs.mkdirSync(targetDir, { recursive: true });
  const cachedRun = tryReuseSinglePresetBenchmark(targetDir);
  if (cachedRun) {
    return cachedRun;
  }
  const commandArgs = [
    "--preset",
    presetName,
    "--profile",
    profileName,
    "--out-dir",
    targetDir,
    "--seed-suite",
    seedSuite.join(","),
  ];
  if (configFilePath) {
    commandArgs.push("--config-file", configFilePath);
  }
  runNodeScript(path.join("tools", "benchmark-runner.mjs"), commandArgs);
  const latestSession = findLatestValidSession(targetDir, 1);
  if (!latestSession) {
    throw new Error(`Benchmark session missing for preset ${presetName} in ${targetDir}`);
  }
  return {
    ...readSingleRunSuite(latestSession.sessionDir),
    reused: false,
  };
}

function arraysMatch(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

function isCalibrationCompatible(payload, fullSeedSuite) {
  return (
    payload &&
    payload.profile === STAGES.calibration.profile &&
    arraysMatch(payload.seed_suite, fullSeedSuite) &&
    payload.baseline &&
    payload.abundance
  );
}

function buildCalibrationPayload(tuningRoot, fullSeedSuite) {
  const calibrationDir = path.join(tuningRoot, "calibration");
  const baselineRun = runSinglePresetBenchmark(
    path.join(calibrationDir, "baseline"),
    "baseline",
    STAGES.calibration.profile,
    fullSeedSuite
  );
  const abundanceRun = runSinglePresetBenchmark(
    path.join(calibrationDir, "abundance"),
    "abundance",
    STAGES.calibration.profile,
    fullSeedSuite
  );
  return {
    generated_at: nowIso(),
    profile: STAGES.calibration.profile,
    seed_suite: fullSeedSuite.slice(),
    baseline: aggregateSuiteMetrics(baselineRun.suitePayload),
    abundance: aggregateSuiteMetrics(abundanceRun.suitePayload),
    runs: {
      baseline: {
        session_dir: path.relative(tuningRoot, baselineRun.sessionDir),
        suite_file: path.relative(tuningRoot, baselineRun.suiteFilePath),
        reused: baselineRun.reused,
      },
      abundance: {
        session_dir: path.relative(tuningRoot, abundanceRun.sessionDir),
        suite_file: path.relative(tuningRoot, abundanceRun.suiteFilePath),
        reused: abundanceRun.reused,
      },
    },
  };
}

function ensureCalibration(tuningRoot, fullSeedSuite, reuseCalibrationDir = null) {
  const calibrationPath = path.join(tuningRoot, "calibration.json");
  const existingCalibration = readJsonIfExists(calibrationPath);
  if (existingCalibration) {
    if (!isCalibrationCompatible(existingCalibration, fullSeedSuite)) {
      throw new Error(`Calibration payload is incompatible with the current seed suite: ${calibrationPath}`);
    }
    return existingCalibration;
  }
  if (reuseCalibrationDir) {
    const reuseCalibrationPath = path.join(reuseCalibrationDir, "calibration.json");
    const reusedCalibration = readJsonIfExists(reuseCalibrationPath);
    if (!reusedCalibration) {
      throw new Error(`Missing calibration.json under ${reuseCalibrationDir}`);
    }
    if (!isCalibrationCompatible(reusedCalibration, fullSeedSuite)) {
      throw new Error(`Calibration payload under ${reuseCalibrationDir} is incompatible with the current tuner.`);
    }
    const copiedCalibration = {
      ...reusedCalibration,
      reused_from: reuseCalibrationDir,
      reused_at: nowIso(),
    };
    writeJson(calibrationPath, copiedCalibration);
    return copiedCalibration;
  }
  const calibration = buildCalibrationPayload(tuningRoot, fullSeedSuite);
  writeJson(calibrationPath, calibration);
  return calibration;
}

function tryReuseFullPresetValidation(validationDir) {
  const existingSession = findLatestValidSession(validationDir, PRESET_NAMES.length);
  if (!existingSession) {
    return null;
  }
  const metricsByPreset = {};
  for (const runRecord of existingSession.sessionManifest.runs) {
    const suitePayload = readJson(path.join(existingSession.sessionDir, runRecord.suite_file));
    metricsByPreset[runRecord.preset_name] = aggregateSuiteMetrics(suitePayload);
  }
  return {
    sessionDir: existingSession.sessionDir,
    sessionManifest: existingSession.sessionManifest,
    metricsByPreset,
    ordering: validatePresetOrdering(metricsByPreset),
    reused: true,
  };
}

function runFullPresetValidation(tuningDir, fullSeedSuite) {
  const validationDir = path.join(tuningDir, "validation", "full_200x60");
  fs.mkdirSync(validationDir, { recursive: true });
  const cachedValidation = tryReuseFullPresetValidation(validationDir);
  if (cachedValidation) {
    return cachedValidation;
  }
  runNodeScript(path.join("tools", "benchmark-runner.mjs"), [
    "--preset",
    "all",
    "--profile",
    "full_200x60",
    "--out-dir",
    validationDir,
    "--seed-suite",
    fullSeedSuite.join(","),
  ]);
  const latestSession = findLatestValidSession(validationDir, PRESET_NAMES.length);
  if (!latestSession) {
    throw new Error(`Validation benchmark session missing in ${validationDir}`);
  }
  const metricsByPreset = {};
  for (const runRecord of latestSession.sessionManifest.runs) {
    const suitePayload = readJson(path.join(latestSession.sessionDir, runRecord.suite_file));
    metricsByPreset[runRecord.preset_name] = aggregateSuiteMetrics(suitePayload);
  }
  return {
    sessionDir: latestSession.sessionDir,
    sessionManifest: latestSession.sessionManifest,
    metricsByPreset,
    ordering: validatePresetOrdering(metricsByPreset),
    reused: false,
  };
}

function runBaselineConfirmation(tuningDir, fullSeedSuite) {
  const confirmationDir = path.join(tuningDir, "validation", "baseline_confirm");
  fs.mkdirSync(confirmationDir, { recursive: true });
  const cachedConfirmation = tryReuseSinglePresetBenchmark(confirmationDir);
  if (cachedConfirmation) {
    return {
      sessionDir: cachedConfirmation.sessionDir,
      sessionManifest: cachedConfirmation.sessionManifest,
      suiteFilePath: cachedConfirmation.suiteFilePath,
      metrics: aggregateSuiteMetrics(cachedConfirmation.suitePayload),
      reused: true,
    };
  }
  const confirmation = runSinglePresetBenchmark(confirmationDir, "baseline", "tune_confirm", fullSeedSuite);
  return {
    sessionDir: confirmation.sessionDir,
    sessionManifest: confirmation.sessionManifest,
    suiteFilePath: confirmation.suiteFilePath,
    metrics: aggregateSuiteMetrics(confirmation.suitePayload),
    reused: false,
  };
}

function evaluateStage(stageName, candidates, profileName, seedSuite, tuningDir, calibration) {
  const existingRanking = loadExistingStageRanking(tuningDir, stageName);
  if (existingRanking) {
    console.log(`[${stageName}] Reusing ${path.basename(getStageOutputPath(tuningDir, stageName))}`);
    return existingRanking;
  }
  const stageDir = path.join(tuningDir, stageName);
  fs.mkdirSync(stageDir, { recursive: true });
  const evaluations = [];
  for (const candidate of candidates) {
    const runArtifacts = runBenchmarkForCandidate(stageDir, candidate, profileName, seedSuite);
    console.log(`[${stageName}] ${runArtifacts.reused ? "Reusing" : "Evaluating"} ${candidate.id}`);
    const metrics = aggregateSuiteMetrics(runArtifacts.suitePayload);
    evaluations.push({
      id: candidate.id,
      source: candidate.source || null,
      config: candidate.config,
      metrics,
      suiteFilePath: runArtifacts.suiteFilePath,
      sessionDir: runArtifacts.sessionDir,
    });
  }
  return rankCandidates(stageName, evaluations, calibration);
}

function buildSearchSpaceArtifact(benchmarkSeedSuite) {
  return {
    generated_at: nowIso(),
    tuner_search_seed: TUNER_SEARCH_SEED,
    population_floor: 256,
    calibration_profile: STAGES.calibration.profile,
    workload_profiles: STAGES,
    coarse_seed_subset: COARSE_SEED_SUITE,
    full_seed_suite: benchmarkSeedSuite,
    tuned_keys: TUNABLE_KEYS,
    search_space: SEARCH_SPACE,
    jitter_space: JITTER_SPACE,
    relaxation_steps: RELAXATION_STEPS,
  };
}

function initializeTuningRoot(tuningRoot, sketchModel, fullSeedSuite, resumed) {
  fs.mkdirSync(tuningRoot, { recursive: true });
  const currentSearchArtifact = buildSearchSpaceArtifact(fullSeedSuite);
  const searchSpacePath = path.join(tuningRoot, "search-space.json");
  const existingSearchArtifact = readJsonIfExists(searchSpacePath);
  if (existingSearchArtifact) {
    const expectedComparable = JSON.stringify(comparableSearchArtifact(currentSearchArtifact));
    const actualComparable = JSON.stringify(comparableSearchArtifact(existingSearchArtifact));
    if (expectedComparable !== actualComparable) {
      throw new Error(`Resume directory is incompatible with the current tuner configuration: ${tuningRoot}`);
    }
  } else {
    writeJson(searchSpacePath, currentSearchArtifact);
  }

  const originalSnapshotPath = getOriginalSketchSnapshotPath(tuningRoot);
  if (!fs.existsSync(originalSnapshotPath)) {
    fs.writeFileSync(originalSnapshotPath, sketchModel.source);
  }

  const currentState = loadRunState(tuningRoot);
  if (!currentState) {
    updateRunState(tuningRoot, {
      created_at: nowIso(),
      status: resumed ? "resumed" : "initialized",
      tuning_root: tuningRoot,
      tuner_search_seed: TUNER_SEARCH_SEED,
      resume_count: resumed ? 1 : 0,
    });
  } else if (resumed) {
    updateRunState(tuningRoot, {
      status: currentState.status || "resumed",
      resume_count: (currentState.resume_count || 0) + 1,
      last_resumed_at: nowIso(),
    });
  }
  return currentSearchArtifact;
}

function loadExistingStageRanking(tuningRoot, stageName) {
  const rankingPath = getStageOutputPath(tuningRoot, stageName);
  const rankingPayload = readJsonIfExists(rankingPath);
  if (!rankingPayload) {
    return null;
  }
  if (!Array.isArray(rankingPayload.rankedForSelection) || !Array.isArray(rankingPayload.leaderboard)) {
    throw new Error(`Invalid stage ranking file: ${rankingPath}`);
  }
  return rankingPayload;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sketchModel = loadSketchModel();
  const fullSeedSuite = Array.isArray(sketchModel.benchmarkSeedSuite) && sketchModel.benchmarkSeedSuite.length > 0
    ? sketchModel.benchmarkSeedSuite.slice()
    : [1337, 2027, 4099, 8191, 65537];
  const baselineReference = pickTunables({
    ...sketchModel.baseConfig,
    ...(sketchModel.experimentPresets.baseline || {}),
  });
  const { tuningRoot, resumed } = resolveTuningRoot(args);
  initializeTuningRoot(tuningRoot, sketchModel, fullSeedSuite, resumed);

  const summaryPath = path.join(tuningRoot, "summary.md");
  if (fs.existsSync(summaryPath)) {
    console.log(`Tuning already completed: ${tuningRoot}`);
    console.log(`Summary: ${summaryPath}`);
    return;
  }

  updateRunState(tuningRoot, {
    status: "running_calibration",
    current_stage: "calibration",
  });
  const calibration = ensureCalibration(tuningRoot, fullSeedSuite, args.reuseCalibrationDir);

  updateRunState(tuningRoot, {
    status: "running_stage1",
    current_stage: "stage1",
  });
  const stage1Candidates = createStage1Candidates(sketchModel.baseConfig, baselineReference);
  const stage1Ranked = evaluateStage(
    "stage1",
    stage1Candidates,
    STAGES.stage1.profile,
    STAGES.stage1.seedSuite,
    tuningRoot,
    calibration
  );
  writeJson(getStageOutputPath(tuningRoot, "stage1"), stage1Ranked);

  updateRunState(tuningRoot, {
    status: "running_stage2",
    current_stage: "stage2",
  });
  const stage2Candidates = createStage2Candidates(stage1Ranked.rankedForSelection, sketchModel.baseConfig);
  const stage2Ranked = evaluateStage("stage2", stage2Candidates, STAGES.stage2.profile, fullSeedSuite, tuningRoot, calibration);
  writeJson(getStageOutputPath(tuningRoot, "stage2"), stage2Ranked);

  updateRunState(tuningRoot, {
    status: "running_stage3",
    current_stage: "stage3",
  });
  const stage3Candidates = createStage3Candidates(stage2Ranked.rankedForSelection);
  const stage3Ranked = evaluateStage("stage3", stage3Candidates, STAGES.stage3.profile, fullSeedSuite, tuningRoot, calibration);
  writeJson(getStageOutputPath(tuningRoot, "stage3"), stage3Ranked);

  if (stage3Ranked.rankedForSelection.length === 0) {
    throw new Error("Autotuning produced no final candidates.");
  }
  const winner = stage3Ranked.rankedForSelection[0];
  const derivedPresets = derivePresetOverrides(winner.config, sketchModel.baseConfig);
  writeJson(path.join(tuningRoot, "winner.json"), {
    generated_at: nowIso(),
    calibration,
    winner,
    presets: derivedPresets,
  });

  const originalSource = fs.existsSync(getOriginalSketchSnapshotPath(tuningRoot))
    ? fs.readFileSync(getOriginalSketchSnapshotPath(tuningRoot), "utf8")
    : sketchModel.source;
  const rewrittenSource = replaceExperimentPresetsBlock(originalSource, derivedPresets);
  fs.writeFileSync(SKETCH_PATH, rewrittenSource);

  let validation = null;
  try {
    updateRunState(tuningRoot, {
      status: "building_and_validating",
      current_stage: "validation",
      winner_id: winner.id,
    });
    runNodeScript(path.join("tools", "build.mjs"));
    const fullPresetValidation = runFullPresetValidation(tuningRoot, fullSeedSuite);
    if (!fullPresetValidation.ordering.passed) {
      throw new Error("Preset ordering validation failed after auto-applying tuned presets.");
    }
    const baselineConfirmation = runBaselineConfirmation(tuningRoot, fullSeedSuite);
    validation = {
      generated_at: nowIso(),
      full_preset_validation: fullPresetValidation,
      baseline_confirmation: baselineConfirmation,
    };
    writeJson(path.join(tuningRoot, "validation.json"), validation);
  } catch (error) {
    fs.writeFileSync(SKETCH_PATH, originalSource);
    runNodeScript(path.join("tools", "build.mjs"));
    updateRunState(tuningRoot, {
      status: "failed_validation",
      current_stage: "validation",
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  writeMarkdownSummary(summaryPath, {
    generatedAt: nowIso(),
    calibration,
    winner,
    stageScores: [
      {
        stage: "stage1",
        bestScore: stage1Ranked.rankedForSelection[0] ? stage1Ranked.rankedForSelection[0].score.totalScore : 0,
      },
      {
        stage: "stage2",
        bestScore: stage2Ranked.rankedForSelection[0] ? stage2Ranked.rankedForSelection[0].score.totalScore : 0,
      },
      {
        stage: "stage3",
        bestScore: stage3Ranked.rankedForSelection[0] ? stage3Ranked.rankedForSelection[0].score.totalScore : 0,
      },
    ],
    validation,
  });

  updateRunState(tuningRoot, {
    status: "completed",
    current_stage: null,
    winner_id: winner.id,
    summary_path: summaryPath,
    validation_path: path.join(tuningRoot, "validation.json"),
  });

  console.log(`Tuning completed: ${tuningRoot}`);
  console.log(`Summary: ${summaryPath}`);
}

main();








