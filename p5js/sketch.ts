// @ts-nocheck
"use strict";
const SAVE_SCHEMA_VERSION = 8;
const TELEMETRY_SCHEMA_VERSION = 1;
const BENCHMARK_SCHEMA_VERSION = 1;
const BENCHMARK_TAIL_WINDOW_GENERATIONS = 10;
const CONTROLLER_ARCH = "mlp_26x4x4";
const OBSERVATION_SECTOR_COUNT = 8;
const OBSERVATION_WALL_CHANNEL_COUNT = 4;
const OBSERVATION_SELF_CHANNEL_COUNT = 4;
const OBSERVATION_MOTION_CHANNEL_COUNT = 2;
const CONTROLLER_INPUT_SIZE = OBSERVATION_SECTOR_COUNT * 2 + OBSERVATION_WALL_CHANNEL_COUNT + OBSERVATION_SELF_CHANNEL_COUNT + OBSERVATION_MOTION_CHANNEL_COUNT;
const CONTROLLER_HIDDEN_SIZE = 4;
const CONTROLLER_OUTPUT_SIZE = 4;
const CONTROLLER_HIDDEN_BLOCK_SIZE = CONTROLLER_INPUT_SIZE + 1 + CONTROLLER_OUTPUT_SIZE;
const CONTROLLER_PARAM_COUNT = CONTROLLER_HIDDEN_SIZE * CONTROLLER_HIDDEN_BLOCK_SIZE + CONTROLLER_OUTPUT_SIZE;
const DNA_COLOR_GENE_FIRST_INDEX = 0;
const DNA_COLOR_GENE_LAST_INDEX = 2;
const DNA_SPEED_GENE_INDEX = 3;
const DNA_SIZE_GENE_INDEX = 4;
const DNA_CONTROLLER_GENE_FIRST_INDEX = 5;
const DNA_GENE_COUNT = DNA_CONTROLLER_GENE_FIRST_INDEX + CONTROLLER_PARAM_COUNT;
const OBS_FOOD_START = 0;
const OBS_AGENT_START = OBS_FOOD_START + OBSERVATION_SECTOR_COUNT;
const OBS_WALL_START = OBS_AGENT_START + OBSERVATION_SECTOR_COUNT;
const OBS_SELF_START = OBS_WALL_START + OBSERVATION_WALL_CHANNEL_COUNT;
const OBS_PREV_MOTION_START = OBS_SELF_START + OBSERVATION_SELF_CHANNEL_COUNT;
const SPATIAL_HASH_CELL_SIZE = 48;
const BOUNDARY_LIFE_PENALTY = 1;
const BOUNDARY_ENERGY_PENALTY = 2;
const RANDOM_SPOT_COUNT = 100;
const RANDOM_SPOT_RADIUS = 2;
const ROULETTE_EPSILON = 1e-6;
const FOOD_DEFAULT_RESPAWN_FRAME = -1;
const FOOD_RENDER_RADIUS = 4;
const FOOD_STEER_RADIUS = 160;
const DEFAULT_LIFE = 300;
const DEFAULT_MAX_LIFE = 900;
const DIRECTIONS = {
    1: { dx: 1, dy: 0 },
    2: { dx: 0, dy: 1 },
    3: { dx: -1, dy: 0 },
    4: { dx: 0, dy: -1 },
};
const DEFAULT_EXPERIMENT_PRESET = "baseline";
const CUSTOM_EXPERIMENT_PRESET = "custom";
const BENCHMARK_SEED_SUITE = [1337, 2027, 4099, 8191, 65537];
const BASE_SIM_CONFIG = {
    seed: 1337,
    maxGenerations: 200,
    populationSize: 200,
    mutationRate: 0.01,
    selectionStrategy: "rank",
    eliteCount: 2,
    rankRetainBestPct: 0.3,
    rankRetainRandomPct: 0.2,
    tournamentK: 3,
    truncationTopPct: 0.5,
    foodLayoutMode: "clustered_patches",
    foodPatchCount: 8,
    foodPatchMinSeparation: 96,
    foodPatchMinRadius: 36,
    foodPatchMaxRadius: 72,
    foodPatchMinUnits: 10,
    foodPatchMaxUnits: 22,
    foodPatchRegenDelayFrames: 36,
    foodPatchRegenBatchSize: 1,
    foodConsumeRadius: 6,
    foodUnitEnergyReward: 14,
    foodEpochLengthGenerations: 20,
    foodPatchRelocationFractionPerEpoch: 0.25,
    foodPatchDriftRadius: 48,
    foodSlotRespawnMode: "random_within_patch",
    foodPatchDormancyThreshold: 0.15,
    foodPatchDormancyDelayFrames: 240,
    foodPatchRecoveryBatchMultiplier: 2,
    foodPatchSeasonalAmplitude: 0.2,
    foodPatchSeasonalPeriodGenerations: 24,
    initialEnergy: 140,
    maxEnergy: 300,
    basalEnergyDrain: 1,
    speedEnergyCoeff: 0.8,
    sizeEnergyCoeff: 0.4,
    minSpeed: 0.5,
    maxSpeed: 3,
    minSize: 2,
    maxSize: 8,
    baseVisionRadius: 48,
    minVisionRadius: 32,
    maxVisionRadius: 144,
    sizeVisionCoeff: 48,
    speedVisionCoeff: 32,
    visionEnergyCoeff: 0.18,
    observationSectorCount: OBSERVATION_SECTOR_COUNT,
    controllerArch: CONTROLLER_ARCH,
    controllerWeightMutationSigma: 0.15,
    useBackgroundFitness: false,
};
const EXPERIMENT_PRESETS = {
    baseline: {
        basalEnergyDrain: 0.92,
    },
    abundance: {
        foodPatchCount: 10,
        foodPatchMinUnits: 14,
        foodPatchMaxUnits: 28,
        foodPatchRegenDelayFrames: 24,
        basalEnergyDrain: 0.9,
        speedEnergyCoeff: 0.65,
        sizeEnergyCoeff: 0.32,
        minSpeed: 0.7,
        maxSpeed: 2.8,
        minSize: 1.8,
        maxSize: 7,
    },
    scarcity: {
        foodPatchCount: 6,
        foodPatchMinUnits: 8,
        foodPatchMaxUnits: 16,
        foodPatchRegenDelayFrames: 60,
        foodUnitEnergyReward: 16,
        basalEnergyDrain: 1.02,
        speedEnergyCoeff: 0.9,
        sizeEnergyCoeff: 0.48,
        minSpeed: 0.6,
        maxSpeed: 2.7,
        minSize: 1.6,
        maxSize: 6.2,
    },
    metabolic_stress: {
        foodPatchCount: 8,
        foodPatchMinUnits: 10,
        foodPatchMaxUnits: 18,
        foodPatchRegenDelayFrames: 48,
        basalEnergyDrain: 1.35,
        speedEnergyCoeff: 0.95,
        sizeEnergyCoeff: 0.65,
        minSpeed: 0.8,
        maxSpeed: 3.2,
        minSize: 2,
        maxSize: 7.5,
    },
};
const PRESET_NAMES = Object.keys(EXPERIMENT_PRESETS);
const SIM_CONFIG = {
    ...BASE_SIM_CONFIG,
    ...EXPERIMENT_PRESETS[DEFAULT_EXPERIMENT_PRESET],
};
let activeConfig = { ...SIM_CONFIG };
let activeSeed = SIM_CONFIG.seed;
let activePresetName = DEFAULT_EXPERIMENT_PRESET;
let rngState = 1;
let population = [];
let alive = [];
let gen_num = 0;
let LIFE = DEFAULT_LIFE;
let MAX_LIFE = DEFAULT_MAX_LIFE;
let NUM_AGENTS = SIM_CONFIG.populationSize;
let TIME = 0;
let MAX_LEN = 0;
let MAX_LEN_LAST_EPISODE = 0;
let W = 0;
let H = 0;
let saveButton = null;
let loadInput = null;
let exportTelemetryButton = null;
let presetCycleButton = null;
let benchmarkButton = null;
let overlayToggleButton = null;
let statusMessage = "";
let overlayVisible = true;
let environmentField = null;
let foodTopology = null;
let foodSystem = null;
let currentFoodEpochId = 0;
let benchmarkSuiteState = null;
let runTelemetry = createRunTelemetry(activeSeed, activeConfig);
let runFinished = false;
let starvationDeathsThisGeneration = 0;
let timeoutDeathsThisGeneration = 0;
let foodSpatialHash = null;
let agentSpatialHash = null;
let controllerStateBatch = {
    agentX: new Float32Array(0),
    agentY: new Float32Array(0),
    agentLife: new Float32Array(0),
    agentEnergy: new Float32Array(0),
    agentSpeed: new Float32Array(0),
    agentSize: new Float32Array(0),
    agentAlive: new Uint8Array(0),
    agentLastDx: new Float32Array(0),
    agentLastDy: new Float32Array(0),
    agentVisionRadius: new Float32Array(0),
    controllerWeights: new Float32Array(0),
    observationBatch: new Float32Array(0),
    outputLogits: new Float32Array(0),
    actionBatch: new Int8Array(0),
};
let observedFoodDensitySumThisGeneration = 0;
let observedAgentDensitySumThisGeneration = 0;
let observationSamplesThisGeneration = 0;
let directionCountsThisGeneration = arrayOfN(CONTROLLER_OUTPUT_SIZE, 0);
function cloneConfig(config) {
    return {
        seed: config.seed,
        maxGenerations: config.maxGenerations,
        populationSize: config.populationSize,
        mutationRate: config.mutationRate,
        selectionStrategy: config.selectionStrategy,
        eliteCount: config.eliteCount,
        rankRetainBestPct: config.rankRetainBestPct,
        rankRetainRandomPct: config.rankRetainRandomPct,
        tournamentK: config.tournamentK,
        truncationTopPct: config.truncationTopPct,
        foodLayoutMode: config.foodLayoutMode,
        foodPatchCount: config.foodPatchCount,
        foodPatchMinSeparation: config.foodPatchMinSeparation,
        foodPatchMinRadius: config.foodPatchMinRadius,
        foodPatchMaxRadius: config.foodPatchMaxRadius,
        foodPatchMinUnits: config.foodPatchMinUnits,
        foodPatchMaxUnits: config.foodPatchMaxUnits,
        foodPatchRegenDelayFrames: config.foodPatchRegenDelayFrames,
        foodPatchRegenBatchSize: config.foodPatchRegenBatchSize,
        foodConsumeRadius: config.foodConsumeRadius,
        foodUnitEnergyReward: config.foodUnitEnergyReward,
        foodEpochLengthGenerations: config.foodEpochLengthGenerations,
        foodPatchRelocationFractionPerEpoch: config.foodPatchRelocationFractionPerEpoch,
        foodPatchDriftRadius: config.foodPatchDriftRadius,
        foodSlotRespawnMode: config.foodSlotRespawnMode,
        foodPatchDormancyThreshold: config.foodPatchDormancyThreshold,
        foodPatchDormancyDelayFrames: config.foodPatchDormancyDelayFrames,
        foodPatchRecoveryBatchMultiplier: config.foodPatchRecoveryBatchMultiplier,
        foodPatchSeasonalAmplitude: config.foodPatchSeasonalAmplitude,
        foodPatchSeasonalPeriodGenerations: config.foodPatchSeasonalPeriodGenerations,
        initialEnergy: config.initialEnergy,
        maxEnergy: config.maxEnergy,
        basalEnergyDrain: config.basalEnergyDrain,
        speedEnergyCoeff: config.speedEnergyCoeff,
        sizeEnergyCoeff: config.sizeEnergyCoeff,
        minSpeed: config.minSpeed,
        maxSpeed: config.maxSpeed,
        minSize: config.minSize,
        maxSize: config.maxSize,
        baseVisionRadius: config.baseVisionRadius,
        minVisionRadius: config.minVisionRadius,
        maxVisionRadius: config.maxVisionRadius,
        sizeVisionCoeff: config.sizeVisionCoeff,
        speedVisionCoeff: config.speedVisionCoeff,
        visionEnergyCoeff: config.visionEnergyCoeff,
        observationSectorCount: config.observationSectorCount,
        controllerArch: config.controllerArch,
        controllerWeightMutationSigma: config.controllerWeightMutationSigma,
        useBackgroundFitness: config.useBackgroundFitness,
    };
}
function normalizeConfig(raw) {
    const config = cloneConfig(raw);
    config.seed = Math.floor(config.seed);
    config.maxGenerations = Math.max(1, Math.floor(config.maxGenerations));
    config.populationSize = Math.max(2, Math.floor(config.populationSize));
    config.mutationRate = clampNumber(config.mutationRate, 0, 1);
    config.eliteCount = clampInt(Math.floor(config.eliteCount), 0, config.populationSize - 1);
    config.rankRetainBestPct = clampNumber(config.rankRetainBestPct, 0, 1);
    config.rankRetainRandomPct = clampNumber(config.rankRetainRandomPct, 0, 1);
    config.tournamentK = Math.max(2, Math.floor(config.tournamentK));
    config.truncationTopPct = clampNumber(config.truncationTopPct, 0.01, 1);
    config.foodLayoutMode = config.foodLayoutMode === "clustered_patches" ? config.foodLayoutMode : "clustered_patches";
    config.foodPatchCount = Math.max(1, Math.floor(config.foodPatchCount));
    config.foodPatchMinSeparation = clampNumber(config.foodPatchMinSeparation, 1, 10000);
    config.foodPatchMinRadius = clampNumber(config.foodPatchMinRadius, 4, 1000);
    config.foodPatchMaxRadius = clampNumber(config.foodPatchMaxRadius, config.foodPatchMinRadius, 1000);
    config.foodPatchMinUnits = Math.max(1, Math.floor(config.foodPatchMinUnits));
    config.foodPatchMaxUnits = Math.max(config.foodPatchMinUnits, Math.floor(config.foodPatchMaxUnits));
    config.foodPatchRegenDelayFrames = Math.max(1, Math.floor(config.foodPatchRegenDelayFrames));
    config.foodPatchRegenBatchSize = Math.max(1, Math.floor(config.foodPatchRegenBatchSize));
    config.foodConsumeRadius = clampNumber(config.foodConsumeRadius, 1, 64);
    config.foodUnitEnergyReward = clampNumber(config.foodUnitEnergyReward, 0, 10000);
    config.foodEpochLengthGenerations = Math.max(1, Math.floor(config.foodEpochLengthGenerations));
    config.foodPatchRelocationFractionPerEpoch = clampNumber(config.foodPatchRelocationFractionPerEpoch, 0, 1);
    config.foodPatchDriftRadius = clampNumber(config.foodPatchDriftRadius, 0, 10000);
    config.foodSlotRespawnMode = config.foodSlotRespawnMode === "random_within_patch"
        ? config.foodSlotRespawnMode
        : "random_within_patch";
    config.foodPatchDormancyThreshold = clampNumber(config.foodPatchDormancyThreshold, 0, 1);
    config.foodPatchDormancyDelayFrames = Math.max(1, Math.floor(config.foodPatchDormancyDelayFrames));
    config.foodPatchRecoveryBatchMultiplier = clampNumber(config.foodPatchRecoveryBatchMultiplier, 1, 1000);
    config.foodPatchSeasonalAmplitude = clampNumber(config.foodPatchSeasonalAmplitude, 0, 0.95);
    config.foodPatchSeasonalPeriodGenerations = Math.max(1, Math.floor(config.foodPatchSeasonalPeriodGenerations));
    config.initialEnergy = clampNumber(config.initialEnergy, 1, 10000);
    config.maxEnergy = clampNumber(config.maxEnergy, 1, 10000);
    config.basalEnergyDrain = clampNumber(config.basalEnergyDrain, 0, 1000);
    config.speedEnergyCoeff = clampNumber(config.speedEnergyCoeff, 0, 1000);
    config.sizeEnergyCoeff = clampNumber(config.sizeEnergyCoeff, 0, 1000);
    config.minSpeed = clampNumber(config.minSpeed, 0.1, 100);
    config.maxSpeed = clampNumber(config.maxSpeed, config.minSpeed, 100);
    config.minSize = clampNumber(config.minSize, 0.5, 200);
    config.maxSize = clampNumber(config.maxSize, config.minSize, 200);
    config.baseVisionRadius = clampNumber(config.baseVisionRadius, 1, 10000);
    config.minVisionRadius = clampNumber(config.minVisionRadius, 1, 10000);
    config.maxVisionRadius = clampNumber(config.maxVisionRadius, config.minVisionRadius, 10000);
    config.sizeVisionCoeff = clampNumber(config.sizeVisionCoeff, 0, 10000);
    config.speedVisionCoeff = clampNumber(config.speedVisionCoeff, 0, 10000);
    config.visionEnergyCoeff = clampNumber(config.visionEnergyCoeff, 0, 1000);
    config.observationSectorCount = clampInt(Math.floor(config.observationSectorCount), OBSERVATION_SECTOR_COUNT, OBSERVATION_SECTOR_COUNT);
    config.controllerArch = config.controllerArch === CONTROLLER_ARCH ? config.controllerArch : CONTROLLER_ARCH;
    config.controllerWeightMutationSigma = clampNumber(config.controllerWeightMutationSigma, 0, 1);
    config.initialEnergy = clampNumber(config.initialEnergy, 1, config.maxEnergy);
    config.useBackgroundFitness = Boolean(config.useBackgroundFitness);
    return config;
}
function buildPresetConfig(presetName, overrides = {}) {
    const preset = EXPERIMENT_PRESETS[presetName] || EXPERIMENT_PRESETS[DEFAULT_EXPERIMENT_PRESET];
    return normalizeConfig({
        ...BASE_SIM_CONFIG,
        ...preset,
        ...overrides,
    });
}
function configsMatch(a, b) {
    const aConfig = cloneConfig(a);
    const bConfig = cloneConfig(b);
    const keys = Object.keys(aConfig);
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (aConfig[key] !== bConfig[key]) {
            return false;
        }
    }
    return true;
}
function inferPresetNameFromConfig(config) {
    for (let i = 0; i < PRESET_NAMES.length; i += 1) {
        const presetName = PRESET_NAMES[i];
        const candidate = buildPresetConfig(presetName, {
            seed: config.seed,
            maxGenerations: config.maxGenerations,
            populationSize: config.populationSize,
            mutationRate: config.mutationRate,
            selectionStrategy: config.selectionStrategy,
            eliteCount: config.eliteCount,
            rankRetainBestPct: config.rankRetainBestPct,
            rankRetainRandomPct: config.rankRetainRandomPct,
            tournamentK: config.tournamentK,
            truncationTopPct: config.truncationTopPct,
            useBackgroundFitness: config.useBackgroundFitness,
        });
        if (configsMatch(candidate, config)) {
            return presetName;
        }
    }
    return CUSTOM_EXPERIMENT_PRESET;
}
function nextPresetName(currentPresetName) {
    const currentIndex = PRESET_NAMES.indexOf(currentPresetName);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % PRESET_NAMES.length;
    return PRESET_NAMES[nextIndex];
}
function nowIso() {
    return new Date().toISOString();
}
function telemetryTimestamp() {
    return nowIso().replace(/[:.]/g, "-");
}
function parsePositiveQueryInt(rawValue) {
    if (!rawValue) {
        return null;
    }
    const parsed = Number.parseInt(rawValue, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function getCaptureExportHook() {
    if (typeof window === "undefined") {
        return null;
    }
    const captureHook = window.__DARWINS_POND_CAPTURE_EXPORT__;
    return typeof captureHook === "function" ? captureHook : null;
}
function emitJsonExport(payload, filename) {
    const captureHook = getCaptureExportHook();
    if (captureHook) {
        captureHook(filename, payload);
        return;
    }
    saveJSON(payload, filename);
}
function sanitizeSeedSuite(rawSeeds) {
    if (!Array.isArray(rawSeeds)) {
        return null;
    }
    const normalized = [];
    for (let i = 0; i < rawSeeds.length; i += 1) {
        const seed = rawSeeds[i];
        if (!Number.isFinite(seed)) {
            continue;
        }
        normalized.push(normalizeSeed(seed));
    }
    return normalized.length > 0 ? normalized : null;
}
function getAutorunOverrides() {
    if (typeof window === "undefined") {
        return null;
    }
    const raw = window.__DARWINS_POND_AUTORUN_OVERRIDES__;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return null;
    }
    const presetName = typeof raw.presetName === "string" && PRESET_NAMES.indexOf(raw.presetName) !== -1
        ? raw.presetName
        : null;
    const configOverrides = raw.configOverrides && typeof raw.configOverrides === "object" && !Array.isArray(raw.configOverrides)
        ? { ...raw.configOverrides }
        : {};
    return {
        presetName,
        configOverrides,
        seedSuite: sanitizeSeedSuite(raw.seedSuite),
        populationSize: Number.isFinite(raw.populationSize) && raw.populationSize > 0
            ? Math.floor(raw.populationSize)
            : null,
        maxGenerations: Number.isFinite(raw.maxGenerations) && raw.maxGenerations > 0
            ? Math.floor(raw.maxGenerations)
            : null,
    };
}
function getAutomationParams() {
    if (typeof window === "undefined" || !window.location) {
        return {
            autorunMode: null,
            presetName: null,
            populationSize: null,
            maxGenerations: null,
        };
    }
    const params = new URLSearchParams(window.location.search);
    const autorunMode = params.get("autorun");
    const requestedPreset = params.get("preset");
    const presetName = requestedPreset && PRESET_NAMES.indexOf(requestedPreset) !== -1
        ? requestedPreset
        : null;
    return {
        autorunMode,
        presetName,
        populationSize: parsePositiveQueryInt(params.get("populationSize")),
        maxGenerations: parsePositiveQueryInt(params.get("maxGenerations")),
    };
}
function createRunTelemetry(seed, config) {
    return {
        schema_version: TELEMETRY_SCHEMA_VERSION,
        seed,
        preset_name: activePresetName,
        benchmark_seed_suite: benchmarkSuiteState ? benchmarkSuiteState.seeds.slice() : null,
        config: cloneConfig(config),
        started_at: nowIso(),
        completed_at: null,
        auto_exported: false,
        generations: [],
    };
}
function arrayOfN(n, value) {
    const out = [];
    for (let i = 0; i < n; i += 1) {
        out.push(value);
    }
    return out;
}
function clampNumber(value, low, high) {
    return Math.max(low, Math.min(high, value));
}
function clampInt(value, low, high) {
    return Math.trunc(clampNumber(value, low, high));
}
function mapUnitGene(gene, minValue, maxValue) {
    const unit = clampNumber(gene, 0, 1);
    return minValue + unit * (maxValue - minValue);
}
function round2(value) {
    return Math.round(value * 100) / 100;
}
function meanOf(values) {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((acc, value) => acc + value, 0) / values.length;
}
function stdDevOf(values) {
    if (values.length === 0) {
        return 0;
    }
    const mean = meanOf(values);
    let variance = 0;
    for (let i = 0; i < values.length; i += 1) {
        const diff = values[i] - mean;
        variance += diff * diff;
    }
    variance /= values.length;
    return Math.sqrt(variance);
}
function buildGeneLayoutMetadata() {
    return {
        color: {
            start: DNA_COLOR_GENE_FIRST_INDEX,
            length: DNA_COLOR_GENE_LAST_INDEX - DNA_COLOR_GENE_FIRST_INDEX + 1,
        },
        speed_trait: {
            index: DNA_SPEED_GENE_INDEX,
        },
        size_trait: {
            index: DNA_SIZE_GENE_INDEX,
        },
        controller: {
            start: DNA_CONTROLLER_GENE_FIRST_INDEX,
            length: CONTROLLER_PARAM_COUNT,
            input_size: CONTROLLER_INPUT_SIZE,
            hidden_size: CONTROLLER_HIDDEN_SIZE,
            output_size: CONTROLLER_OUTPUT_SIZE,
            hidden_block_size: CONTROLLER_HIDDEN_BLOCK_SIZE,
            arch: CONTROLLER_ARCH,
        },
    };
}
function resetGenerationObservationMetrics() {
    observedFoodDensitySumThisGeneration = 0;
    observedAgentDensitySumThisGeneration = 0;
    observationSamplesThisGeneration = 0;
    directionCountsThisGeneration = arrayOfN(CONTROLLER_OUTPUT_SIZE, 0);
}
function ensureControllerStateBatch(count) {
    if (controllerStateBatch.agentX.length === count) {
        return controllerStateBatch;
    }
    controllerStateBatch = {
        agentX: new Float32Array(count),
        agentY: new Float32Array(count),
        agentLife: new Float32Array(count),
        agentEnergy: new Float32Array(count),
        agentSpeed: new Float32Array(count),
        agentSize: new Float32Array(count),
        agentAlive: new Uint8Array(count),
        agentLastDx: new Float32Array(count),
        agentLastDy: new Float32Array(count),
        agentVisionRadius: new Float32Array(count),
        controllerWeights: new Float32Array(count * CONTROLLER_PARAM_COUNT),
        observationBatch: new Float32Array(count * CONTROLLER_INPUT_SIZE),
        outputLogits: new Float32Array(count * CONTROLLER_OUTPUT_SIZE),
        actionBatch: new Int8Array(count),
    };
    return controllerStateBatch;
}
function getSpeedTraitNorm(agent) {
    return clampNumber(agent.dna.genes[DNA_SPEED_GENE_INDEX], 0, 1);
}
function getSizeTraitNorm(agent) {
    return clampNumber(agent.dna.genes[DNA_SIZE_GENE_INDEX], 0, 1);
}
function computeVisionRadiusFromTraits(sizeNorm, speedNorm) {
    return clampNumber(activeConfig.baseVisionRadius +
        activeConfig.sizeVisionCoeff * sizeNorm +
        activeConfig.speedVisionCoeff * speedNorm, activeConfig.minVisionRadius, activeConfig.maxVisionRadius);
}
function createSpatialHash(cellSize = SPATIAL_HASH_CELL_SIZE) {
    return {
        cellSize,
        buckets: new Map(),
    };
}
function spatialHashCell(value, cellSize) {
    return Math.floor(value / cellSize);
}
function spatialHashKey(cellX, cellY) {
    return `${cellX},${cellY}`;
}
function addSpatialEntry(hash, x, y, payload) {
    const cellX = spatialHashCell(x, hash.cellSize);
    const cellY = spatialHashCell(y, hash.cellSize);
    const key = spatialHashKey(cellX, cellY);
    if (!hash.buckets.has(key)) {
        hash.buckets.set(key, []);
    }
    hash.buckets.get(key).push(payload);
}
function querySpatialHash(hash, x, y, radius, callback) {
    if (!hash || radius < 0) {
        return;
    }
    const minCellX = spatialHashCell(x - radius, hash.cellSize);
    const maxCellX = spatialHashCell(x + radius, hash.cellSize);
    const minCellY = spatialHashCell(y - radius, hash.cellSize);
    const maxCellY = spatialHashCell(y + radius, hash.cellSize);
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
            const bucket = hash.buckets.get(spatialHashKey(cellX, cellY));
            if (!bucket) {
                continue;
            }
            for (let i = 0; i < bucket.length; i += 1) {
                callback(bucket[i]);
            }
        }
    }
}
function syncControllerStateBatch(pop, aliveMask) {
    const batch = ensureControllerStateBatch(pop.length);
    for (let i = 0; i < pop.length; i += 1) {
        const agent = pop[i];
        batch.agentX[i] = agent.x;
        batch.agentY[i] = agent.y;
        batch.agentLife[i] = agent.life;
        batch.agentEnergy[i] = agent.energy;
        batch.agentSpeed[i] = agent.speed;
        batch.agentSize[i] = agent.size;
        batch.agentAlive[i] = aliveMask[i] ? 1 : 0;
        batch.agentLastDx[i] = agent.lastDx || 0;
        batch.agentLastDy[i] = agent.lastDy || 0;
        batch.agentVisionRadius[i] = agent.visionRadius;
        const baseOffset = i * CONTROLLER_PARAM_COUNT;
        for (let g = 0; g < CONTROLLER_PARAM_COUNT; g += 1) {
            batch.controllerWeights[baseOffset + g] = agent.dna.genes[DNA_CONTROLLER_GENE_FIRST_INDEX + g];
        }
    }
    return batch;
}
function computePopulationDiagnostics(pop, aliveMask = null) {
    if (pop.length === 0) {
        return {
            meanAliveEnergy: 0,
            meanEnergyRemaining: 0,
            minEnergyRemaining: 0,
            maxEnergyRemaining: 0,
            meanSpeedTrait: 0,
            meanSizeTrait: 0,
            speedTraitStdDev: 0,
            sizeTraitStdDev: 0,
            meanVisionRadius: 0,
            visionRadiusStdDev: 0,
            controllerWeightStdDev: 0,
            aliveFramesMean: 0,
            fastAgentCount: 0,
            slowAgentCount: 0,
            largeAgentCount: 0,
            smallAgentCount: 0,
        };
    }
    const energyValues = pop.map((agent) => Math.max(0, agent.energy));
    const ageValues = pop.map((agent) => agent.ageFrames);
    const speedValues = pop.map((agent) => agent.speed);
    const sizeValues = pop.map((agent) => agent.size);
    const visionValues = pop.map((agent) => agent.visionRadius);
    const speedMidpoint = (activeConfig.minSpeed + activeConfig.maxSpeed) / 2;
    const sizeMidpoint = (activeConfig.minSize + activeConfig.maxSize) / 2;
    const controllerValues = [];
    let fastAgentCount = 0;
    let largeAgentCount = 0;
    for (let i = 0; i < pop.length; i += 1) {
        if (pop[i].speed >= speedMidpoint) {
            fastAgentCount += 1;
        }
        if (pop[i].size >= sizeMidpoint) {
            largeAgentCount += 1;
        }
        for (let g = DNA_CONTROLLER_GENE_FIRST_INDEX; g < DNA_GENE_COUNT; g += 1) {
            controllerValues.push(pop[i].dna.genes[g]);
        }
    }
    const aliveEnergyValues = [];
    if (aliveMask) {
        for (let i = 0; i < pop.length; i += 1) {
            if (aliveMask[i]) {
                aliveEnergyValues.push(Math.max(0, pop[i].energy));
            }
        }
    }
    return {
        meanAliveEnergy: round2(meanOf(aliveEnergyValues)),
        meanEnergyRemaining: round2(meanOf(energyValues)),
        minEnergyRemaining: round2(Math.min(...energyValues)),
        maxEnergyRemaining: round2(Math.max(...energyValues)),
        meanSpeedTrait: round2(meanOf(speedValues)),
        meanSizeTrait: round2(meanOf(sizeValues)),
        speedTraitStdDev: round2(stdDevOf(speedValues)),
        sizeTraitStdDev: round2(stdDevOf(sizeValues)),
        meanVisionRadius: round2(meanOf(visionValues)),
        visionRadiusStdDev: round2(stdDevOf(visionValues)),
        controllerWeightStdDev: round2(stdDevOf(controllerValues)),
        aliveFramesMean: round2(meanOf(ageValues)),
        fastAgentCount,
        slowAgentCount: pop.length - fastAgentCount,
        largeAgentCount,
        smallAgentCount: pop.length - largeAgentCount,
    };
}
function computeDirectionChoiceEntropy() {
    const totalChoices = directionCountsThisGeneration.reduce((acc, value) => acc + value, 0);
    if (totalChoices <= 0) {
        return 0;
    }
    let entropy = 0;
    for (let i = 0; i < directionCountsThisGeneration.length; i += 1) {
        const count = directionCountsThisGeneration[i];
        if (count <= 0) {
            continue;
        }
        const probability = count / totalChoices;
        entropy -= probability * Math.log(probability);
    }
    return directionCountsThisGeneration.length > 1
        ? round2(entropy / Math.log(directionCountsThisGeneration.length))
        : 0;
}
function getGenerationObservationMeans() {
    if (observationSamplesThisGeneration <= 0) {
        return {
            meanObservedFoodDensity: 0,
            meanObservedAgentDensity: 0,
        };
    }
    return {
        meanObservedFoodDensity: round2(observedFoodDensitySumThisGeneration / observationSamplesThisGeneration),
        meanObservedAgentDensity: round2(observedAgentDensitySumThisGeneration / observationSamplesThisGeneration),
    };
}
function buildFoodSpatialHash() {
    const hash = createSpatialHash();
    if (!foodSystem || !foodTopology) {
        return hash;
    }
    for (let patchIdx = 0; patchIdx < foodTopology.patches.length; patchIdx += 1) {
        const runtimePatch = foodSystem.patches[patchIdx];
        for (let slotIdx = 0; slotIdx < runtimePatch.slots.length; slotIdx += 1) {
            const runtimeSlot = runtimePatch.slots[slotIdx];
            if (!runtimeSlot.active) {
                continue;
            }
            addSpatialEntry(hash, runtimeSlot.x, runtimeSlot.y, {
                patchIdx,
                slotIdx,
                x: runtimeSlot.x,
                y: runtimeSlot.y,
            });
        }
    }
    return hash;
}
function buildAgentSpatialHash(pop, aliveMask) {
    const hash = createSpatialHash();
    for (let i = 0; i < pop.length; i += 1) {
        if (!aliveMask[i]) {
            continue;
        }
        addSpatialEntry(hash, pop[i].x, pop[i].y, {
            index: i,
            x: pop[i].x,
            y: pop[i].y,
        });
    }
    return hash;
}
function sectorIndexForDelta(dx, dy) {
    let angle = Math.atan2(dy, dx);
    if (angle < 0) {
        angle += Math.PI * 2;
    }
    const sectorWidth = (Math.PI * 2) / OBSERVATION_SECTOR_COUNT;
    return clampInt(Math.floor(angle / sectorWidth), 0, OBSERVATION_SECTOR_COUNT - 1);
}
function saturateSectorSum(value) {
    return clampNumber(1 - Math.exp(-value), 0, 1);
}
function buildObservationBatch(pop, aliveMask) {
    const batch = syncControllerStateBatch(pop, aliveMask);
    batch.observationBatch.fill(0);
    let frameFoodDensityTotal = 0;
    let frameAgentDensityTotal = 0;
    let frameObservationCount = 0;
    for (let i = 0; i < pop.length; i += 1) {
        if (!aliveMask[i]) {
            continue;
        }
        const agent = pop[i];
        const baseOffset = i * CONTROLLER_INPUT_SIZE;
        const radius = batch.agentVisionRadius[i];
        const radiusSq = radius * radius;
        const foodSectorAccum = arrayOfN(OBSERVATION_SECTOR_COUNT, 0);
        const agentSectorAccum = arrayOfN(OBSERVATION_SECTOR_COUNT, 0);
        let foodDensityAccum = 0;
        let agentDensityAccum = 0;
        querySpatialHash(foodSpatialHash, agent.x, agent.y, radius, (entry) => {
            const dx = entry.x - agent.x;
            const dy = entry.y - agent.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= 0 || distSq > radiusSq) {
                return;
            }
            const contribution = 1 - Math.sqrt(distSq) / Math.max(1, radius);
            const sectorIndex = sectorIndexForDelta(dx, dy);
            foodSectorAccum[sectorIndex] += contribution;
            foodDensityAccum += contribution;
        });
        querySpatialHash(agentSpatialHash, agent.x, agent.y, radius, (entry) => {
            if (entry.index === i) {
                return;
            }
            const dx = entry.x - agent.x;
            const dy = entry.y - agent.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= 0 || distSq > radiusSq) {
                return;
            }
            const contribution = 1 - Math.sqrt(distSq) / Math.max(1, radius);
            const sectorIndex = sectorIndexForDelta(dx, dy);
            agentSectorAccum[sectorIndex] += contribution;
            agentDensityAccum += contribution;
        });
        for (let sector = 0; sector < OBSERVATION_SECTOR_COUNT; sector += 1) {
            batch.observationBatch[baseOffset + OBS_FOOD_START + sector] = saturateSectorSum(foodSectorAccum[sector]);
            batch.observationBatch[baseOffset + OBS_AGENT_START + sector] = saturateSectorSum(agentSectorAccum[sector]);
        }
        batch.observationBatch[baseOffset + OBS_WALL_START + 0] = 1 - clampNumber(agent.y / Math.max(1, radius), 0, 1);
        batch.observationBatch[baseOffset + OBS_WALL_START + 1] = 1 - clampNumber((W - agent.x) / Math.max(1, radius), 0, 1);
        batch.observationBatch[baseOffset + OBS_WALL_START + 2] = 1 - clampNumber((H - agent.y) / Math.max(1, radius), 0, 1);
        batch.observationBatch[baseOffset + OBS_WALL_START + 3] = 1 - clampNumber(agent.x / Math.max(1, radius), 0, 1);
        batch.observationBatch[baseOffset + OBS_SELF_START + 0] = clampNumber(agent.energy / Math.max(1, activeConfig.maxEnergy), 0, 1);
        batch.observationBatch[baseOffset + OBS_SELF_START + 1] = clampNumber(agent.life / Math.max(1, LIFE), 0, 1);
        batch.observationBatch[baseOffset + OBS_SELF_START + 2] = getSpeedTraitNorm(agent);
        batch.observationBatch[baseOffset + OBS_SELF_START + 3] = getSizeTraitNorm(agent);
        batch.observationBatch[baseOffset + OBS_PREV_MOTION_START + 0] = clampNumber(batch.agentLastDx[i] / Math.max(1, activeConfig.maxSpeed), -1, 1);
        batch.observationBatch[baseOffset + OBS_PREV_MOTION_START + 1] = clampNumber(batch.agentLastDy[i] / Math.max(1, activeConfig.maxSpeed), -1, 1);
        frameFoodDensityTotal += foodDensityAccum / Math.max(1, OBSERVATION_SECTOR_COUNT);
        frameAgentDensityTotal += agentDensityAccum / Math.max(1, OBSERVATION_SECTOR_COUNT);
        frameObservationCount += 1;
    }
    if (frameObservationCount > 0) {
        observedFoodDensitySumThisGeneration += frameFoodDensityTotal / frameObservationCount;
        observedAgentDensitySumThisGeneration += frameAgentDensityTotal / frameObservationCount;
        observationSamplesThisGeneration += 1;
    }
    return batch;
}
function evaluateControllerBatch(pop, aliveMask) {
    const batch = controllerStateBatch;
    batch.outputLogits.fill(0);
    for (let i = 0; i < pop.length; i += 1) {
        if (!aliveMask[i]) {
            continue;
        }
        const observationOffset = i * CONTROLLER_INPUT_SIZE;
        const controllerOffset = i * CONTROLLER_PARAM_COUNT;
        const outputOffset = i * CONTROLLER_OUTPUT_SIZE;
        const outputBiasOffset = controllerOffset + CONTROLLER_HIDDEN_SIZE * CONTROLLER_HIDDEN_BLOCK_SIZE;
        for (let outputIndex = 0; outputIndex < CONTROLLER_OUTPUT_SIZE; outputIndex += 1) {
            batch.outputLogits[outputOffset + outputIndex] = batch.controllerWeights[outputBiasOffset + outputIndex];
        }
        let hiddenBase = controllerOffset;
        for (let hiddenIndex = 0; hiddenIndex < CONTROLLER_HIDDEN_SIZE; hiddenIndex += 1) {
            let hiddenValue = batch.controllerWeights[hiddenBase + CONTROLLER_INPUT_SIZE];
            for (let inputIndex = 0; inputIndex < CONTROLLER_INPUT_SIZE; inputIndex += 1) {
                hiddenValue += batch.observationBatch[observationOffset + inputIndex] *
                    batch.controllerWeights[hiddenBase + inputIndex];
            }
            hiddenValue = Math.tanh(hiddenValue);
            const outgoingOffset = hiddenBase + CONTROLLER_INPUT_SIZE + 1;
            for (let outputIndex = 0; outputIndex < CONTROLLER_OUTPUT_SIZE; outputIndex += 1) {
                batch.outputLogits[outputOffset + outputIndex] +=
                    hiddenValue * batch.controllerWeights[outgoingOffset + outputIndex];
            }
            hiddenBase += CONTROLLER_HIDDEN_BLOCK_SIZE;
        }
    }
    return batch;
}
function selectActions(pop, aliveMask) {
    const batch = controllerStateBatch;
    for (let i = 0; i < pop.length; i += 1) {
        if (!aliveMask[i]) {
            batch.actionBatch[i] = 0;
            continue;
        }
        const outputOffset = i * CONTROLLER_OUTPUT_SIZE;
        let bestAction = 1;
        let bestLogit = Number.NEGATIVE_INFINITY;
        for (let outputIndex = 0; outputIndex < CONTROLLER_OUTPUT_SIZE; outputIndex += 1) {
            const logit = batch.outputLogits[outputOffset + outputIndex];
            if (logit > bestLogit) {
                bestLogit = logit;
                bestAction = outputIndex + 1;
            }
        }
        batch.actionBatch[i] = bestAction;
        directionCountsThisGeneration[bestAction - 1] += 1;
    }
    return batch.actionBatch;
}
function createBenchmarkSuite(presetName, configSnapshot) {
    return createBenchmarkSuiteWithSeeds(presetName, configSnapshot, BENCHMARK_SEED_SUITE);
}
function createBenchmarkSuiteWithSeeds(presetName, configSnapshot, seedSuite) {
    const suiteSeeds = sanitizeSeedSuite(seedSuite) || BENCHMARK_SEED_SUITE.slice();
    return {
        schema_version: BENCHMARK_SCHEMA_VERSION,
        preset_name: presetName,
        config: cloneConfig(configSnapshot),
        seeds: suiteSeeds.slice(),
        started_at: nowIso(),
        completed_at: null,
        entries: [],
    };
}
function averageGenerationMetric(generations, key) {
    if (!generations || generations.length === 0) {
        return 0;
    }
    let total = 0;
    for (let i = 0; i < generations.length; i += 1) {
        const generation = generations[i];
        const value = generation && Number.isFinite(generation[key]) ? generation[key] : 0;
        total += value;
    }
    return total / generations.length;
}
function generationStarvationRatio(generation) {
    if (!generation) {
        return 0;
    }
    const starvationDeaths = Number.isFinite(generation.starvationDeaths) ? generation.starvationDeaths : 0;
    const timeoutDeaths = Number.isFinite(generation.timeoutDeaths) ? generation.timeoutDeaths : 0;
    const deathTotal = starvationDeaths + timeoutDeaths;
    return deathTotal > 0 ? starvationDeaths / deathTotal : 0;
}
function computeBenchmarkTailSummary(generations, windowSize = BENCHMARK_TAIL_WINDOW_GENERATIONS) {
    if (!generations || generations.length === 0) {
        return {
            tailWindowGenerations: 0,
            bestFitnessTailAvg: 0,
            meanEnergyTailAvg: 0,
            starvationRatioTailAvg: 0,
            patchEntropyTailAvg: 0,
            topPatchShareTailAvg: 0,
            patchTurnoverRateTailAvg: 0,
            speedTraitStdDevTailAvg: 0,
            sizeTraitStdDevTailAvg: 0,
            meanVisionRadiusTailAvg: 0,
            visionRadiusStdDevTailAvg: 0,
            directionChoiceEntropyTailAvg: 0,
            meanObservedFoodDensityTailAvg: 0,
            meanObservedAgentDensityTailAvg: 0,
        };
    }
    const tailGenerations = generations.slice(-Math.min(windowSize, generations.length));
    return {
        tailWindowGenerations: tailGenerations.length,
        bestFitnessTailAvg: round2(averageGenerationMetric(tailGenerations, "bestFitness")),
        meanEnergyTailAvg: round2(averageGenerationMetric(tailGenerations, "meanEnergyRemaining")),
        starvationRatioTailAvg: round2(meanOf(tailGenerations.map((generation) => generationStarvationRatio(generation)))),
        patchEntropyTailAvg: round2(averageGenerationMetric(tailGenerations, "patchConsumptionEntropy")),
        topPatchShareTailAvg: round2(averageGenerationMetric(tailGenerations, "topPatchConsumptionShare")),
        patchTurnoverRateTailAvg: round2(averageGenerationMetric(tailGenerations, "patchTurnoverRate")),
        speedTraitStdDevTailAvg: round2(averageGenerationMetric(tailGenerations, "speedTraitStdDev")),
        sizeTraitStdDevTailAvg: round2(averageGenerationMetric(tailGenerations, "sizeTraitStdDev")),
        meanVisionRadiusTailAvg: round2(averageGenerationMetric(tailGenerations, "meanVisionRadius")),
        visionRadiusStdDevTailAvg: round2(averageGenerationMetric(tailGenerations, "visionRadiusStdDev")),
        directionChoiceEntropyTailAvg: round2(averageGenerationMetric(tailGenerations, "directionChoiceEntropy")),
        meanObservedFoodDensityTailAvg: round2(averageGenerationMetric(tailGenerations, "meanObservedFoodDensity")),
        meanObservedAgentDensityTailAvg: round2(averageGenerationMetric(tailGenerations, "meanObservedAgentDensity")),
    };
}
function buildBenchmarkEntry(telemetry, telemetryFilename) {
    const generations = telemetry.generations;
    const lastGeneration = generations.length > 0 ? generations[generations.length - 1] : null;
    const starvationTotal = lastGeneration ? lastGeneration.starvationDeaths : 0;
    const timeoutTotal = lastGeneration ? lastGeneration.timeoutDeaths : 0;
    const deathTotal = starvationTotal + timeoutTotal;
    const relocatedDuringRun = generations.some((generation) => generation.patchRelocatedCount > 0);
    const dormantDuringRun = generations.some((generation) => generation.patchDormantCount > 0);
    const tailSummary = computeBenchmarkTailSummary(generations);
    return {
        seed: telemetry.seed,
        preset_name: telemetry.preset_name || activePresetName,
        telemetry_filename: telemetryFilename,
        bestFitness: lastGeneration ? lastGeneration.bestFitness : 0,
        meanEnergyRemaining: lastGeneration ? lastGeneration.meanEnergyRemaining : 0,
        starvationRatio: round2(deathTotal > 0 ? starvationTotal / deathTotal : 0),
        starvationDeaths: starvationTotal,
        timeoutDeaths: timeoutTotal,
        meanSpeedTrait: lastGeneration ? lastGeneration.meanSpeedTrait : 0,
        meanSizeTrait: lastGeneration ? lastGeneration.meanSizeTrait : 0,
        meanVisionRadius: lastGeneration ? lastGeneration.meanVisionRadius : 0,
        visionRadiusStdDev: lastGeneration ? lastGeneration.visionRadiusStdDev : 0,
        controllerWeightStdDev: lastGeneration ? lastGeneration.controllerWeightStdDev : 0,
        directionChoiceEntropy: lastGeneration ? lastGeneration.directionChoiceEntropy : 0,
        meanObservedFoodDensity: lastGeneration ? lastGeneration.meanObservedFoodDensity : 0,
        meanObservedAgentDensity: lastGeneration ? lastGeneration.meanObservedAgentDensity : 0,
        foodsConsumedTotal: lastGeneration ? lastGeneration.foodsConsumedTotal : 0,
        activePatchCountEnd: lastGeneration ? lastGeneration.activePatchCountEnd : 0,
        depletedPatchCount: lastGeneration ? lastGeneration.depletedPatchCount : 0,
        patchDormantCount: lastGeneration ? lastGeneration.patchDormantCount : 0,
        patchRelocatedCount: lastGeneration ? lastGeneration.patchRelocatedCount : 0,
        patchTurnoverRate: lastGeneration ? lastGeneration.patchTurnoverRate : 0,
        meanNearestPatchDistance: lastGeneration ? lastGeneration.meanNearestPatchDistance : 0,
        speedTraitStdDev: lastGeneration ? lastGeneration.speedTraitStdDev : 0,
        sizeTraitStdDev: lastGeneration ? lastGeneration.sizeTraitStdDev : 0,
        relocatedDuringRun,
        dormantDuringRun,
        topPatchConsumptionShare: lastGeneration ? lastGeneration.topPatchConsumptionShare : 0,
        patchConsumptionEntropy: lastGeneration ? lastGeneration.patchConsumptionEntropy : 0,
        ...tailSummary,
    };
}
function normalizeSeed(seed) {
    const normalized = Math.floor(seed) >>> 0;
    return normalized === 0 ? 1 : normalized;
}
function setRngSeed(seed) {
    rngState = normalizeSeed(seed);
}
function setRngState(state) {
    rngState = normalizeSeed(state);
}
function getRngState() {
    return rngState >>> 0;
}
function nextFloat() {
    let x = rngState >>> 0;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    rngState = x === 0 ? 1 : x;
    return (rngState >>> 0) / 4294967296;
}
function range(minValue, maxValue) {
    if (maxValue <= minValue) {
        return minValue;
    }
    return minValue + nextFloat() * (maxValue - minValue);
}
function choice(values) {
    if (values.length === 0) {
        throw new Error("Cannot select from an empty array.");
    }
    const idx = clampInt(Math.floor(nextFloat() * values.length), 0, values.length - 1);
    return values[idx];
}
function shuffle(values) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = clampInt(Math.floor(nextFloat() * (i + 1)), 0, i);
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
}
function posToColor(x, y, xCycles, yCycles) {
    const xMap = (x / H) * 2 * PI * xCycles * y;
    const yMap = (y / H) * 2 * PI * yCycles * x;
    return Math.trunc((255 / 4) * (sin(xMap) + cos(yMap) + 2));
}
function fieldIndex(x, y, widthValue) {
    return y * widthValue + x;
}
function buildEnvironmentField(widthValue, heightValue) {
    const green = new Float32Array(widthValue * heightValue);
    const backgroundImage = createImage(widthValue, heightValue);
    backgroundImage.loadPixels();
    const xShift = range(0, widthValue);
    const yShift = range(0, heightValue);
    const xCycles = range(1, 20);
    const yCycles = range(1, 20);
    for (let y = 0; y < heightValue; y += 1) {
        for (let x = 0; x < widthValue; x += 1) {
            const idx = fieldIndex(x, y, widthValue);
            const green255 = posToColor(x + 1 + xShift, y + 1 + yShift, xCycles, yCycles);
            green[idx] = green255 / 255;
            const pixelIdx = idx * 4;
            backgroundImage.pixels[pixelIdx] = 0;
            backgroundImage.pixels[pixelIdx + 1] = green255;
            backgroundImage.pixels[pixelIdx + 2] = 0;
            backgroundImage.pixels[pixelIdx + 3] = 255;
        }
    }
    for (let i = 0; i < RANDOM_SPOT_COUNT; i += 1) {
        const blackSpot = nextFloat() < 0.5;
        const spotGreen = blackSpot ? 0 : 255;
        const centerX = clampInt(Math.floor(range(0, widthValue)), 0, widthValue - 1);
        const centerY = clampInt(Math.floor(range(0, heightValue)), 0, heightValue - 1);
        for (let dy = -RANDOM_SPOT_RADIUS; dy <= RANDOM_SPOT_RADIUS; dy += 1) {
            for (let dx = -RANDOM_SPOT_RADIUS; dx <= RANDOM_SPOT_RADIUS; dx += 1) {
                const x = centerX + dx;
                const y = centerY + dy;
                if (x < 0 || y < 0 || x >= widthValue || y >= heightValue) {
                    continue;
                }
                const idx = fieldIndex(x, y, widthValue);
                green[idx] = spotGreen / 255;
                const pixelIdx = idx * 4;
                backgroundImage.pixels[pixelIdx] = 0;
                backgroundImage.pixels[pixelIdx + 1] = spotGreen;
                backgroundImage.pixels[pixelIdx + 2] = 0;
                backgroundImage.pixels[pixelIdx + 3] = 255;
            }
        }
    }
    backgroundImage.updatePixels();
    return {
        width: widthValue,
        height: heightValue,
        green,
        backgroundImage,
    };
}
function paintEnvironment() {
    background(12, 16, 22);
}
function refreshEnvironment() {
    environmentField = buildEnvironmentField(W, H);
    paintEnvironment();
}
function sampleGreen(x, y) {
    if (!environmentField) {
        return 0;
    }
    const xi = clampInt(Math.round(x), 0, environmentField.width - 1);
    const yi = clampInt(Math.round(y), 0, environmentField.height - 1);
    return environmentField.green[fieldIndex(xi, yi, environmentField.width)];
}
function randomCanvasPosition(pad = 1) {
    const minX = clampNumber(pad, 1, Math.max(1, W - 2));
    const maxX = Math.max(minX, W - pad);
    const minY = clampNumber(pad, 1, Math.max(1, H - 2));
    const maxY = Math.max(minY, H - pad);
    return {
        x: range(minX, maxX),
        y: range(minY, maxY),
    };
}
function randomPointInCircle(radius) {
    const angle = nextFloat() * TWO_PI;
    const distance = Math.sqrt(nextFloat()) * radius;
    return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
    };
}
function fallbackPatchAnchor(index, patchCount, pad) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(patchCount)));
    const rows = Math.max(1, Math.ceil(patchCount / cols));
    const col = index % cols;
    const row = Math.floor(index / cols);
    const usableWidth = Math.max(1, W - 2 * pad);
    const usableHeight = Math.max(1, H - 2 * pad);
    const cellWidth = usableWidth / cols;
    const cellHeight = usableHeight / rows;
    return {
        x: clampNumber(pad + cellWidth * (col + 0.5), pad, Math.max(pad, W - pad)),
        y: clampNumber(pad + cellHeight * (row + 0.5), pad, Math.max(pad, H - pad)),
    };
}
function canPlacePatch(candidate, patches, ignorePatchId = null) {
    for (let i = 0; i < patches.length; i += 1) {
        const existing = patches[i];
        if (ignorePatchId !== null && existing.id === ignorePatchId) {
            continue;
        }
        const existingX = existing.x === undefined ? existing.cx : existing.x;
        const existingY = existing.y === undefined ? existing.cy : existing.y;
        const dx = candidate.x - existingX;
        const dy = candidate.y - existingY;
        const minDistance = activeConfig.foodPatchMinSeparation + candidate.radius + existing.radius;
        if (dx * dx + dy * dy < minDistance * minDistance) {
            return false;
        }
    }
    return true;
}
function samplePatchSlotPosition(patch, occupiedSlots = []) {
    const usableRadius = Math.max(6, patch.radius - FOOD_RENDER_RADIUS - 2);
    const slotMinDistanceSq = Math.max(16, FOOD_RENDER_RADIUS * FOOD_RENDER_RADIUS * 3);
    let placed = null;
    for (let attempt = 0; attempt < 32; attempt += 1) {
        const local = randomPointInCircle(usableRadius);
        const x = clampNumber(patch.cx + local.x, 1, Math.max(1, W - 2));
        const y = clampNumber(patch.cy + local.y, 1, Math.max(1, H - 2));
        let valid = true;
        for (let i = 0; i < occupiedSlots.length; i += 1) {
            const dx = x - occupiedSlots[i].x;
            const dy = y - occupiedSlots[i].y;
            if (dx * dx + dy * dy < slotMinDistanceSq) {
                valid = false;
                break;
            }
        }
        if (valid || attempt === 31) {
            placed = {
                x: round2(x),
                y: round2(y),
            };
            break;
        }
    }
    return placed;
}
function buildRuntimePatchSlots(patch) {
    const slots = [];
    for (let slotId = 0; slotId < patch.slotCount; slotId += 1) {
        const placed = samplePatchSlotPosition(patch, slots);
        slots.push({
            slotId,
            x: placed.x,
            y: placed.y,
            active: true,
            respawnAtFrame: FOOD_DEFAULT_RESPAWN_FRAME,
        });
    }
    return slots;
}
function createFoodTopology() {
    if (activeConfig.foodLayoutMode !== "clustered_patches") {
        throw new Error(`Unsupported food layout mode: ${activeConfig.foodLayoutMode}`);
    }
    const patches = [];
    for (let patchId = 0; patchId < activeConfig.foodPatchCount; patchId += 1) {
        const radius = round2(range(activeConfig.foodPatchMinRadius, activeConfig.foodPatchMaxRadius));
        const pad = radius + FOOD_RENDER_RADIUS + 4;
        let anchor = null;
        const maxAttempts = Math.max(16, activeConfig.foodPatchCount * 48);
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const candidate = {
                ...randomCanvasPosition(pad),
                radius,
            };
            if (canPlacePatch(candidate, patches)) {
                anchor = candidate;
                break;
            }
        }
        if (!anchor) {
            const fallback = fallbackPatchAnchor(patchId, activeConfig.foodPatchCount, pad);
            anchor = {
                x: fallback.x,
                y: fallback.y,
                radius,
            };
        }
        const richnessMultiplier = round2(range(0.8, 1.25));
        const qualityMultiplier = round2(range(0.8, 1.3));
        const regenDelayMultiplier = round2(range(0.85, 1.2));
        const capacityMultiplier = round2(range(0.85, 1.35));
        const baseUnits = range(activeConfig.foodPatchMinUnits, activeConfig.foodPatchMaxUnits + 1);
        const unitCount = clampInt(Math.round(baseUnits * capacityMultiplier), activeConfig.foodPatchMinUnits, activeConfig.foodPatchMaxUnits);
        const regenDelayFrames = Math.max(1, Math.round(activeConfig.foodPatchRegenDelayFrames * regenDelayMultiplier));
        patches.push({
            id: patchId,
            cx: round2(anchor.x),
            cy: round2(anchor.y),
            radius,
            richnessMultiplier,
            qualityMultiplier,
            regenDelayMultiplier,
            capacityMultiplier,
            regenDelayFrames,
            seasonalPhase: round2(range(0, TWO_PI)),
            slotCount: unitCount,
        });
    }
    return {
        layoutMode: activeConfig.foodLayoutMode,
        epochLengthGenerations: activeConfig.foodEpochLengthGenerations,
        patches,
    };
}
function createFoodSystemFromTopology(topology, epochId = currentFoodEpochId) {
    return {
        epochId,
        patches: topology.patches.map((patch) => ({
            id: patch.id,
            activeUnitCount: patch.slotCount,
            consumedThisGeneration: 0,
            dormantUntilFrame: FOOD_DEFAULT_RESPAWN_FRAME,
            respawnAccumulator: 0,
            relocatedThisGeneration: false,
            turnoverThisGeneration: 0,
            slots: buildRuntimePatchSlots(patch),
        })),
        consumedThisGeneration: 0,
        respawnedThisGeneration: 0,
    };
}
function cloneFoodTopology(source) {
    return {
        layoutMode: source.layoutMode,
        epochLengthGenerations: source.epochLengthGenerations,
        patches: source.patches.map((patch) => ({
            id: patch.id,
            cx: patch.cx,
            cy: patch.cy,
            radius: patch.radius,
            richnessMultiplier: patch.richnessMultiplier,
            qualityMultiplier: patch.qualityMultiplier,
            regenDelayMultiplier: patch.regenDelayMultiplier,
            capacityMultiplier: patch.capacityMultiplier,
            regenDelayFrames: patch.regenDelayFrames,
            seasonalPhase: patch.seasonalPhase,
            slotCount: patch.slotCount,
        })),
    };
}
function cloneFoodSystem(source) {
    return {
        epochId: source.epochId,
        patches: source.patches.map((patch) => ({
            id: patch.id,
            activeUnitCount: patch.activeUnitCount,
            consumedThisGeneration: patch.consumedThisGeneration,
            dormantUntilFrame: patch.dormantUntilFrame,
            respawnAccumulator: patch.respawnAccumulator,
            relocatedThisGeneration: patch.relocatedThisGeneration,
            turnoverThisGeneration: patch.turnoverThisGeneration,
            slots: patch.slots.map((slot) => ({
                slotId: slot.slotId,
                x: slot.x,
                y: slot.y,
                active: slot.active,
                respawnAtFrame: slot.respawnAtFrame,
            })),
        })),
        consumedThisGeneration: source.consumedThisGeneration,
        respawnedThisGeneration: source.respawnedThisGeneration,
    };
}
function serializeFoodSystem(topology, runtime) {
    return {
        layout_mode: topology.layoutMode,
        topology: {
            epoch_length_generations: topology.epochLengthGenerations,
            patches: topology.patches.map((patch) => ({
                id: patch.id,
                cx: patch.cx,
                cy: patch.cy,
                radius: patch.radius,
                richness_multiplier: patch.richnessMultiplier,
                quality_multiplier: patch.qualityMultiplier,
                regen_delay_multiplier: patch.regenDelayMultiplier,
                capacity_multiplier: patch.capacityMultiplier,
                regen_delay_frames: patch.regenDelayFrames,
                seasonal_phase: patch.seasonalPhase,
                slot_count: patch.slotCount,
            })),
        },
        runtime: {
            epoch_id: runtime.epochId,
            patches: runtime.patches.map((patch) => ({
                id: patch.id,
                active_unit_count: patch.activeUnitCount,
                consumed_this_generation: patch.consumedThisGeneration,
                dormant_until_frame: patch.dormantUntilFrame,
                respawn_accumulator: patch.respawnAccumulator,
                relocated_this_generation: patch.relocatedThisGeneration,
                turnover_this_generation: patch.turnoverThisGeneration,
                slots: patch.slots.map((slot) => ({
                    slot_id: slot.slotId,
                    x: slot.x,
                    y: slot.y,
                    active: slot.active,
                    respawn_at_frame: slot.respawnAtFrame,
                })),
            })),
            consumed_this_generation: runtime.consumedThisGeneration,
            respawned_this_generation: runtime.respawnedThisGeneration,
        },
    };
}
function initializeFoodForRun() {
    foodTopology = createFoodTopology();
    foodSystem = createFoodSystemFromTopology(foodTopology);
    currentFoodEpochId = 0;
}
function resetFoodGenerationCounters() {
    if (!foodSystem) {
        return;
    }
    foodSystem.consumedThisGeneration = 0;
    foodSystem.respawnedThisGeneration = 0;
    for (let i = 0; i < foodSystem.patches.length; i += 1) {
        const patch = foodSystem.patches[i];
        patch.consumedThisGeneration = 0;
        patch.relocatedThisGeneration = false;
        patch.turnoverThisGeneration = 0;
    }
}
function countTotalFoodUnits() {
    if (!foodTopology) {
        return 0;
    }
    let totalCount = 0;
    for (let i = 0; i < foodTopology.patches.length; i += 1) {
        totalCount += foodTopology.patches[i].slotCount;
    }
    return totalCount;
}
function countActiveFoodUnits() {
    if (!foodSystem) {
        return 0;
    }
    let activeCount = 0;
    for (let i = 0; i < foodSystem.patches.length; i += 1) {
        activeCount += foodSystem.patches[i].activeUnitCount;
    }
    return activeCount;
}
function countActivePatches() {
    if (!foodSystem) {
        return 0;
    }
    let activeCount = 0;
    for (let i = 0; i < foodSystem.patches.length; i += 1) {
        if (foodSystem.patches[i].activeUnitCount > 0) {
            activeCount += 1;
        }
    }
    return activeCount;
}
function sampleSeasonalMultiplier(topologyPatch, epochId = currentFoodEpochId) {
    const amplitude = activeConfig.foodPatchSeasonalAmplitude;
    if (amplitude <= 0) {
        return 1;
    }
    const period = Math.max(1, activeConfig.foodPatchSeasonalPeriodGenerations);
    const seasonal = 1 + amplitude * Math.sin(((epochId % period) / period) * TWO_PI + topologyPatch.seasonalPhase);
    return clampNumber(seasonal, 0.25, 2);
}
function isPatchDormant(runtimePatch, currentFrame) {
    return runtimePatch.dormantUntilFrame !== FOOD_DEFAULT_RESPAWN_FRAME &&
        runtimePatch.dormantUntilFrame > currentFrame;
}
function markPatchDormant(topologyPatch, runtimePatch, currentFrame) {
    if (topologyPatch.slotCount <= 0 || isPatchDormant(runtimePatch, currentFrame)) {
        return;
    }
    const activeFraction = runtimePatch.activeUnitCount / Math.max(1, topologyPatch.slotCount);
    if (activeFraction > activeConfig.foodPatchDormancyThreshold) {
        return;
    }
    runtimePatch.dormantUntilFrame = currentFrame + activeConfig.foodPatchDormancyDelayFrames;
    runtimePatch.respawnAccumulator = 0;
}
function updateFoodRespawns(currentFrame) {
    if (!foodSystem || !foodTopology) {
        return;
    }
    for (let i = 0; i < foodSystem.patches.length; i += 1) {
        const topologyPatch = foodTopology.patches[i];
        const runtimePatch = foodSystem.patches[i];
        if (isPatchDormant(runtimePatch, currentFrame)) {
            continue;
        }
        const eligibleInactiveCount = runtimePatch.slots.filter((slot) => !slot.active && slot.respawnAtFrame <= currentFrame).length;
        if (eligibleInactiveCount <= 0) {
            if (runtimePatch.activeUnitCount >= topologyPatch.slotCount) {
                runtimePatch.respawnAccumulator = 0;
                runtimePatch.dormantUntilFrame = FOOD_DEFAULT_RESPAWN_FRAME;
            }
            continue;
        }
        const seasonalMultiplier = sampleSeasonalMultiplier(topologyPatch);
        let respawnRate = activeConfig.foodPatchRegenBatchSize * topologyPatch.qualityMultiplier * seasonalMultiplier;
        if (runtimePatch.dormantUntilFrame !== FOOD_DEFAULT_RESPAWN_FRAME &&
            runtimePatch.activeUnitCount < topologyPatch.slotCount) {
            respawnRate /= activeConfig.foodPatchRecoveryBatchMultiplier;
        }
        runtimePatch.respawnAccumulator += respawnRate;
        let respawnBudget = Math.min(Math.floor(runtimePatch.respawnAccumulator), eligibleInactiveCount, topologyPatch.slotCount - runtimePatch.activeUnitCount);
        if (respawnBudget <= 0) {
            continue;
        }
        const occupiedSlots = runtimePatch.slots
            .filter((slot) => slot.active)
            .map((slot) => ({ x: slot.x, y: slot.y }));
        for (let slotIdx = 0; slotIdx < runtimePatch.slots.length; slotIdx += 1) {
            if (respawnBudget <= 0) {
                break;
            }
            const slot = runtimePatch.slots[slotIdx];
            if (slot.active || slot.respawnAtFrame > currentFrame) {
                continue;
            }
            const respawnPosition = activeConfig.foodSlotRespawnMode === "random_within_patch"
                ? samplePatchSlotPosition(topologyPatch, occupiedSlots)
                : samplePatchSlotPosition(topologyPatch, occupiedSlots);
            slot.x = respawnPosition.x;
            slot.y = respawnPosition.y;
            slot.active = true;
            slot.respawnAtFrame = FOOD_DEFAULT_RESPAWN_FRAME;
            runtimePatch.activeUnitCount += 1;
            runtimePatch.turnoverThisGeneration += 1;
            foodSystem.respawnedThisGeneration += 1;
            runtimePatch.respawnAccumulator = Math.max(0, runtimePatch.respawnAccumulator - 1);
            occupiedSlots.push({ x: slot.x, y: slot.y });
            respawnBudget -= 1;
        }
        if (runtimePatch.activeUnitCount >= topologyPatch.slotCount) {
            runtimePatch.dormantUntilFrame = FOOD_DEFAULT_RESPAWN_FRAME;
        }
    }
}
function renderActiveFoods() {
    if (!foodSystem || !foodTopology) {
        return;
    }
    noStroke();
    for (let patchIdx = 0; patchIdx < foodTopology.patches.length; patchIdx += 1) {
        const topologyPatch = foodTopology.patches[patchIdx];
        const runtimePatch = foodSystem.patches[patchIdx];
        const activeFraction = topologyPatch.slotCount > 0
            ? runtimePatch.activeUnitCount / topologyPatch.slotCount
            : 0;
        const seasonalMultiplier = sampleSeasonalMultiplier(topologyPatch);
        const dormantAlphaMultiplier = isPatchDormant(runtimePatch, TIME) ? 0.45 : 1;
        fill(255, 220, 64, 18 + activeFraction * 32 * dormantAlphaMultiplier + seasonalMultiplier * 8);
        circle(topologyPatch.cx, topologyPatch.cy, topologyPatch.radius * 2.35);
        fill(255, 220, 64, isPatchDormant(runtimePatch, TIME) ? 92 : 220);
        for (let slotIdx = 0; slotIdx < runtimePatch.slots.length; slotIdx += 1) {
            const runtimeSlot = runtimePatch.slots[slotIdx];
            if (!runtimeSlot.active) {
                continue;
            }
            circle(runtimeSlot.x, runtimeSlot.y, FOOD_RENDER_RADIUS * 2);
        }
    }
}
function findNearestActiveFood(x, y) {
    if (!foodSystem || !foodTopology) {
        return null;
    }
    let nearest = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    const queryRadius = Math.sqrt(W * W + H * H);
    querySpatialHash(foodSpatialHash || buildFoodSpatialHash(), x, y, queryRadius, (entry) => {
        const runtimePatch = foodSystem.patches[entry.patchIdx];
        const runtimeSlot = runtimePatch.slots[entry.slotIdx];
        if (!runtimeSlot.active) {
            return;
        }
        const dx = runtimeSlot.x - x;
        const dy = runtimeSlot.y - y;
        const distSq = dx * dx + dy * dy;
        if (distSq >= bestDistSq) {
            return;
        }
        bestDistSq = distSq;
        nearest = {
            x: runtimeSlot.x,
            y: runtimeSlot.y,
            patchId: runtimePatch.id,
            slotId: runtimeSlot.slotId,
        };
    });
    if (!nearest) {
        return null;
    }
    return {
        food: nearest,
        distSq: bestDistSq,
    };
}
function sampleFoodDensity(x, y, radius = FOOD_STEER_RADIUS) {
    if (!foodSystem || !foodTopology || radius <= 0) {
        return 0;
    }
    let count = 0;
    const radiusSq = radius * radius;
    querySpatialHash(foodSpatialHash || buildFoodSpatialHash(), x, y, radius, (entry) => {
        const runtimePatch = foodSystem.patches[entry.patchIdx];
        const runtimeSlot = runtimePatch.slots[entry.slotIdx];
        if (!runtimeSlot.active) {
            return;
        }
        const dx = runtimeSlot.x - x;
        const dy = runtimeSlot.y - y;
        if (dx * dx + dy * dy <= radiusSq) {
            count += 1;
        }
    });
    return count / Math.max(1, countTotalFoodUnits());
}
function tryConsumeFood(agent, currentFrame) {
    if (!foodSystem || !foodTopology) {
        return false;
    }
    const consumeRadius = activeConfig.foodConsumeRadius + agent.size * 0.5;
    const consumeRadiusSq = consumeRadius * consumeRadius;
    let bestPatchIdx = -1;
    let bestSlotIdx = -1;
    let bestDistSq = Number.POSITIVE_INFINITY;
    querySpatialHash(foodSpatialHash || buildFoodSpatialHash(), agent.x, agent.y, consumeRadius, (entry) => {
        const runtimePatch = foodSystem.patches[entry.patchIdx];
        const runtimeSlot = runtimePatch.slots[entry.slotIdx];
        if (!runtimeSlot.active) {
            return;
        }
        const dx = agent.x - runtimeSlot.x;
        const dy = agent.y - runtimeSlot.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > consumeRadiusSq || distSq >= bestDistSq) {
            return;
        }
        bestPatchIdx = entry.patchIdx;
        bestSlotIdx = entry.slotIdx;
        bestDistSq = distSq;
    });
    if (bestPatchIdx === -1 || bestSlotIdx === -1) {
        return false;
    }
    const topologyPatch = foodTopology.patches[bestPatchIdx];
    const runtimePatch = foodSystem.patches[bestPatchIdx];
    const runtimeSlot = runtimePatch.slots[bestSlotIdx];
    if (!runtimeSlot.active) {
        return false;
    }
    runtimeSlot.active = false;
    runtimeSlot.respawnAtFrame = currentFrame + topologyPatch.regenDelayFrames;
    runtimePatch.activeUnitCount = Math.max(0, runtimePatch.activeUnitCount - 1);
    runtimePatch.consumedThisGeneration += 1;
    foodSystem.consumedThisGeneration += 1;
    markPatchDormant(topologyPatch, runtimePatch, currentFrame);
    const energyReward = activeConfig.foodUnitEnergyReward * topologyPatch.qualityMultiplier * sampleSeasonalMultiplier(topologyPatch);
    agent.energy = Math.min(activeConfig.maxEnergy, agent.energy + energyReward);
    return true;
}
function getFoodEpochIdForGeneration(generationNumber) {
    return Math.floor(Math.max(0, generationNumber - 1) / Math.max(1, activeConfig.foodEpochLengthGenerations));
}
function randomPointNear(x, y, radius, pad) {
    const local = randomPointInCircle(radius);
    return {
        x: clampNumber(x + local.x, pad, Math.max(pad, W - pad)),
        y: clampNumber(y + local.y, pad, Math.max(pad, H - pad)),
    };
}
function findPatchAnchorForRelocation(topologyPatch) {
    const pad = topologyPatch.radius + FOOD_RENDER_RADIUS + 4;
    for (let attempt = 0; attempt < 48; attempt += 1) {
        const candidate = {
            ...randomPointNear(topologyPatch.cx, topologyPatch.cy, activeConfig.foodPatchDriftRadius, pad),
            radius: topologyPatch.radius,
            id: topologyPatch.id,
        };
        if (canPlacePatch(candidate, foodTopology.patches, topologyPatch.id)) {
            return candidate;
        }
    }
    const maxAttempts = Math.max(16, activeConfig.foodPatchCount * 32);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const candidate = {
            ...randomCanvasPosition(pad),
            radius: topologyPatch.radius,
            id: topologyPatch.id,
        };
        if (canPlacePatch(candidate, foodTopology.patches, topologyPatch.id)) {
            return candidate;
        }
    }
    const fallback = fallbackPatchAnchor(topologyPatch.id, activeConfig.foodPatchCount, pad);
    const fallbackCandidate = {
        x: fallback.x,
        y: fallback.y,
        radius: topologyPatch.radius,
        id: topologyPatch.id,
    };
    return canPlacePatch(fallbackCandidate, foodTopology.patches, topologyPatch.id)
        ? fallbackCandidate
        : { x: topologyPatch.cx, y: topologyPatch.cy, radius: topologyPatch.radius, id: topologyPatch.id };
}
function relocatePatchRuntimeSlots(topologyPatch, runtimePatch) {
    const occupiedSlots = [];
    for (let slotIdx = 0; slotIdx < runtimePatch.slots.length; slotIdx += 1) {
        const slot = runtimePatch.slots[slotIdx];
        const nextPosition = samplePatchSlotPosition(topologyPatch, occupiedSlots);
        slot.x = nextPosition.x;
        slot.y = nextPosition.y;
        occupiedSlots.push({ x: slot.x, y: slot.y });
    }
}
function maybeAdvanceFoodEpoch() {
    if (!foodTopology || !foodSystem) {
        return;
    }
    const nextEpochId = getFoodEpochIdForGeneration(gen_num);
    if (nextEpochId <= currentFoodEpochId) {
        foodSystem.epochId = currentFoodEpochId;
        return;
    }
    const requestedCount = Math.round(foodTopology.patches.length * activeConfig.foodPatchRelocationFractionPerEpoch);
    const relocationCount = activeConfig.foodPatchRelocationFractionPerEpoch > 0
        ? clampInt(Math.max(1, requestedCount), 1, foodTopology.patches.length)
        : 0;
    const patchOrder = shuffle(foodTopology.patches.map((patch) => patch.id));
    for (let i = 0; i < relocationCount; i += 1) {
        const patchId = patchOrder[i];
        const patchIndex = foodTopology.patches.findIndex((patch) => patch.id === patchId);
        if (patchIndex === -1) {
            continue;
        }
        const topologyPatch = foodTopology.patches[patchIndex];
        const runtimePatch = foodSystem.patches[patchIndex];
        const nextAnchor = findPatchAnchorForRelocation(topologyPatch);
        const moved = round2(nextAnchor.x) !== topologyPatch.cx || round2(nextAnchor.y) !== topologyPatch.cy;
        topologyPatch.cx = round2(nextAnchor.x);
        topologyPatch.cy = round2(nextAnchor.y);
        relocatePatchRuntimeSlots(topologyPatch, runtimePatch);
        runtimePatch.relocatedThisGeneration = moved;
    }
    currentFoodEpochId = nextEpochId;
    foodSystem.epochId = currentFoodEpochId;
}
function exportTelemetry(autoExport = false) {
    if (runTelemetry.generations.length === 0) {
        statusMessage = "Telemetry export skipped: no generations recorded yet.";
        return null;
    }
    const tag = autoExport ? "auto" : "manual";
    const filename = `telemetry_run_${activeSeed}_${tag}_${telemetryTimestamp()}.json`;
    if (autoExport) {
        runTelemetry.auto_exported = true;
        runTelemetry.completed_at = nowIso();
    }
    emitJsonExport(runTelemetry, filename);
    statusMessage = autoExport
        ? `Run finished. Telemetry auto-exported to ${filename}`
        : `Telemetry exported to ${filename}`;
    return filename;
}
function exportBenchmarkSuite() {
    if (!benchmarkSuiteState || benchmarkSuiteState.entries.length === 0) {
        return null;
    }
    benchmarkSuiteState.completed_at = nowIso();
    const filename = `benchmark_suite_${benchmarkSuiteState.preset_name}_${telemetryTimestamp()}.json`;
    emitJsonExport(benchmarkSuiteState, filename);
    return filename;
}
function resetRunMetrics() {
    LIFE = DEFAULT_LIFE;
    MAX_LIFE = DEFAULT_MAX_LIFE;
    MAX_LEN = 0;
    MAX_LEN_LAST_EPISODE = 0;
    TIME = 0;
    starvationDeathsThisGeneration = 0;
    timeoutDeathsThisGeneration = 0;
    resetGenerationObservationMetrics();
}
function resetSimulation(seed, config, presetName = activePresetName) {
    activePresetName = presetName;
    resetRunMetrics();
    initializeRun(seed, config);
    gen_num = 1;
    clear();
    refreshEnvironment();
    initializeFoodForRun();
    population = createPopulation(NUM_AGENTS);
    alive = arrayOfN(NUM_AGENTS, true);
    ensureControllerStateBatch(NUM_AGENTS);
    foodSpatialHash = null;
    agentSpatialHash = null;
    runFinished = false;
    loop();
}
function cycleExperimentPreset() {
    benchmarkSuiteState = null;
    const nextPreset = nextPresetName(activePresetName);
    const nextConfig = buildPresetConfig(nextPreset, {
        seed: activeSeed,
        maxGenerations: activeConfig.maxGenerations,
        populationSize: activeConfig.populationSize,
        mutationRate: activeConfig.mutationRate,
        selectionStrategy: activeConfig.selectionStrategy,
        eliteCount: activeConfig.eliteCount,
        rankRetainBestPct: activeConfig.rankRetainBestPct,
        rankRetainRandomPct: activeConfig.rankRetainRandomPct,
        tournamentK: activeConfig.tournamentK,
        truncationTopPct: activeConfig.truncationTopPct,
    });
    resetSimulation(activeSeed, nextConfig, nextPreset);
    statusMessage = `Preset changed to ${nextPreset}.`;
}
function startBenchmarkSuite(requestedPresetName = null, configOverrides = null, seedSuite = null) {
    const presetName = requestedPresetName && PRESET_NAMES.indexOf(requestedPresetName) !== -1
        ? requestedPresetName
        : PRESET_NAMES.indexOf(activePresetName) === -1
            ? DEFAULT_EXPERIMENT_PRESET
            : activePresetName;
    const benchmarkSeeds = sanitizeSeedSuite(seedSuite) || BENCHMARK_SEED_SUITE.slice();
    const benchmarkConfig = buildPresetConfig(presetName, {
        seed: benchmarkSeeds[0],
        maxGenerations: activeConfig.maxGenerations,
        populationSize: activeConfig.populationSize,
        mutationRate: activeConfig.mutationRate,
        selectionStrategy: activeConfig.selectionStrategy,
        eliteCount: activeConfig.eliteCount,
        rankRetainBestPct: activeConfig.rankRetainBestPct,
        rankRetainRandomPct: activeConfig.rankRetainRandomPct,
        tournamentK: activeConfig.tournamentK,
        truncationTopPct: activeConfig.truncationTopPct,
        ...configOverrides,
    });
    benchmarkSuiteState = createBenchmarkSuiteWithSeeds(presetName, benchmarkConfig, benchmarkSeeds);
    const firstSeed = benchmarkSuiteState.seeds[0];
    benchmarkConfig.seed = firstSeed;
    resetSimulation(firstSeed, benchmarkConfig, presetName);
    statusMessage = `Benchmark suite started for preset ${presetName}.`;
}
function maybeStartAutorun() {
    const automation = getAutomationParams();
    if (automation.autorunMode !== "benchmark") {
        return;
    }
    const overridePayload = getAutorunOverrides();
    const presetName = overridePayload && overridePayload.presetName
        ? overridePayload.presetName
        : automation.presetName;
    const configOverrides = overridePayload ? { ...overridePayload.configOverrides } : {};
    if (overridePayload && overridePayload.populationSize !== null) {
        configOverrides.populationSize = overridePayload.populationSize;
    }
    else if (automation.populationSize !== null) {
        configOverrides.populationSize = automation.populationSize;
    }
    if (overridePayload && overridePayload.maxGenerations !== null) {
        configOverrides.maxGenerations = overridePayload.maxGenerations;
    }
    else if (automation.maxGenerations !== null) {
        configOverrides.maxGenerations = automation.maxGenerations;
    }
    startBenchmarkSuite(presetName, configOverrides, overridePayload ? overridePayload.seedSuite : null);
}
function advanceBenchmarkSuite(telemetryFilename) {
    if (!benchmarkSuiteState) {
        return false;
    }
    benchmarkSuiteState.entries.push(buildBenchmarkEntry(runTelemetry, telemetryFilename));
    const nextIndex = benchmarkSuiteState.entries.length;
    if (nextIndex >= benchmarkSuiteState.seeds.length) {
        const benchmarkFilename = exportBenchmarkSuite();
        benchmarkSuiteState = null;
        runFinished = true;
        noLoop();
        statusMessage = benchmarkFilename
            ? `Benchmark suite completed and exported to ${benchmarkFilename}`
            : "Benchmark suite completed.";
        return true;
    }
    const nextSeed = benchmarkSuiteState.seeds[nextIndex];
    const nextConfig = buildPresetConfig(benchmarkSuiteState.preset_name, {
        seed: nextSeed,
        maxGenerations: activeConfig.maxGenerations,
        populationSize: activeConfig.populationSize,
        mutationRate: activeConfig.mutationRate,
        selectionStrategy: activeConfig.selectionStrategy,
        eliteCount: activeConfig.eliteCount,
        rankRetainBestPct: activeConfig.rankRetainBestPct,
        rankRetainRandomPct: activeConfig.rankRetainRandomPct,
        tournamentK: activeConfig.tournamentK,
        truncationTopPct: activeConfig.truncationTopPct,
    });
    resetSimulation(nextSeed, nextConfig, benchmarkSuiteState.preset_name);
    statusMessage = `Benchmark continuing with seed ${nextSeed} (${nextIndex + 1}/${benchmarkSuiteState.seeds.length}).`;
    return true;
}
function createControls() {
    if (!saveButton) {
        saveButton = createButton("Save");
        saveButton.mousePressed(saveEnv);
    }
    if (!loadInput) {
        loadInput = createFileInput(onLoadFile, false);
    }
    if (!exportTelemetryButton) {
        exportTelemetryButton = createButton("Export Telemetry");
        exportTelemetryButton.mousePressed(() => {
            exportTelemetry(false);
        });
    }
    if (!presetCycleButton) {
        presetCycleButton = createButton("Cycle Preset");
        presetCycleButton.mousePressed(cycleExperimentPreset);
    }
    if (!benchmarkButton) {
        benchmarkButton = createButton("Run Benchmark");
        benchmarkButton.mousePressed(startBenchmarkSuite);
    }
    if (!overlayToggleButton) {
        overlayToggleButton = createButton("");
        overlayToggleButton.mousePressed(toggleOverlayVisibility);
    }
    layoutControls();
    setOverlayVisibility(overlayVisible);
}
function layoutControls() {
    const leftX = 0;
    const topY = 0;
    const verticalGap = 20;
    if (saveButton) {
        saveButton.position(leftX, topY);
    }
    if (loadInput) {
        loadInput.position(leftX, topY + verticalGap);
    }
    if (exportTelemetryButton) {
        exportTelemetryButton.position(leftX, topY + verticalGap * 2);
    }
    if (presetCycleButton) {
        presetCycleButton.position(leftX, topY + verticalGap * 3);
    }
    if (benchmarkButton) {
        benchmarkButton.position(leftX, topY + verticalGap * 4);
    }
    if (overlayToggleButton) {
        const toggleWidth = overlayToggleButton.elt ? overlayToggleButton.elt.offsetWidth : 72;
        const toggleX = Math.max(0, windowWidth - toggleWidth - 8);
        overlayToggleButton.position(toggleX, 8);
    }
}
function setOverlayVisibility(isVisible) {
    overlayVisible = isVisible;
    if (saveButton) {
        isVisible ? saveButton.show() : saveButton.hide();
    }
    if (loadInput) {
        isVisible ? loadInput.show() : loadInput.hide();
    }
    if (exportTelemetryButton) {
        isVisible ? exportTelemetryButton.show() : exportTelemetryButton.hide();
    }
    if (presetCycleButton) {
        isVisible ? presetCycleButton.show() : presetCycleButton.hide();
    }
    if (benchmarkButton) {
        isVisible ? benchmarkButton.show() : benchmarkButton.hide();
    }
    if (overlayToggleButton) {
        overlayToggleButton.html(isVisible ? "Hide UI" : "Show UI");
        overlayToggleButton.show();
    }
}
function toggleOverlayVisibility() {
    setOverlayVisibility(!overlayVisible);
}
function showStatus() {
    if (!overlayVisible || !statusMessage) {
        return;
    }
    noStroke();
    fill(255, 64, 64);
    text(statusMessage, 10, 526);
}
function drawHud() {
    if (!overlayVisible) {
        return;
    }
    const diagnostics = computePopulationDiagnostics(population, alive);
    const benchmarkLabel = benchmarkSuiteState
        ? `${benchmarkSuiteState.entries.length + 1}/${benchmarkSuiteState.seeds.length}`
        : "off";
    const dormantPatchCount = foodSystem
        ? foodSystem.patches.filter((patch) => isPatchDormant(patch, TIME)).length
        : 0;
    const observationMeans = getGenerationObservationMeans();
    noStroke();
    fill(255);
    textSize(16);
    text(`Gen: ${gen_num}/${activeConfig.maxGenerations}`, 10, 80);
    text(`Max Len: ${MAX_LEN}`, 10, 102);
    text(`Last Pool: ${MAX_LEN_LAST_EPISODE}`, 10, 124);
    text(`Seed: ${activeSeed}`, 10, 146);
    text(`Strategy: ${activeConfig.selectionStrategy}`, 10, 168);
    text(`Food Units/Patches: ${countActiveFoodUnits()}/${countTotalFoodUnits()} | ${countActivePatches()}/${activeConfig.foodPatchCount}`, 10, 190);
    text(`Food Eaten: ${foodSystem ? foodSystem.consumedThisGeneration : 0}`, 10, 212);
    text(`Mean Energy (alive): ${diagnostics.meanAliveEnergy}`, 10, 234);
    text(`Starvations: ${starvationDeathsThisGeneration}`, 10, 256);
    text(`Mean Speed/Size: ${diagnostics.meanSpeedTrait} / ${diagnostics.meanSizeTrait}`, 10, 278);
    text(`Preset: ${activePresetName}`, 10, 300);
    text(`Benchmark / Epoch: ${benchmarkLabel} / ${currentFoodEpochId}`, 10, 322);
    text(`Energy Range: ${diagnostics.minEnergyRemaining} - ${diagnostics.maxEnergyRemaining}`, 10, 344);
    text(`Speed SD / Size SD: ${diagnostics.speedTraitStdDev} / ${diagnostics.sizeTraitStdDev}`, 10, 366);
    text(`Vision Mean/SD: ${diagnostics.meanVisionRadius} / ${diagnostics.visionRadiusStdDev}`, 10, 388);
    text(`Controller SD / Dir Entropy: ${diagnostics.controllerWeightStdDev} / ${computeDirectionChoiceEntropy()}`, 10, 410);
    text(`Observed Food/Agents: ${observationMeans.meanObservedFoodDensity} / ${observationMeans.meanObservedAgentDensity}`, 10, 432);
    text(`Alive Frames Mean: ${diagnostics.aliveFramesMean}`, 10, 454);
    text(`Fast/Slow Large/Small: ${diagnostics.fastAgentCount}/${diagnostics.slowAgentCount} ${diagnostics.largeAgentCount}/${diagnostics.smallAgentCount}`, 10, 476);
    text(`Dormant Patches: ${dormantPatchCount}`, 10, 498);
}
function applyConfig(config) {
    activeConfig = normalizeConfig(config);
    activeSeed = activeConfig.seed;
    NUM_AGENTS = activeConfig.populationSize;
}
function initializeRun(seed, config) {
    applyConfig(config);
    setRngSeed(seed);
    runTelemetry = createRunTelemetry(activeSeed, activeConfig);
    runFinished = false;
    starvationDeathsThisGeneration = 0;
    timeoutDeathsThisGeneration = 0;
}
function setup() {
    pixelDensity(1);
    W = Math.max(64, Math.floor(displayWidth / 2));
    H = Math.max(64, Math.floor(displayHeight / 2));
    createCanvas(W, H);
    resetSimulation(SIM_CONFIG.seed, SIM_CONFIG, DEFAULT_EXPERIMENT_PRESET);
    createControls();
    maybeStartAutorun();
}
function windowResized() {
    layoutControls();
}
function draw() {
    if (runFinished) {
        return;
    }
    TIME += 1;
    paintEnvironment();
    updateFoodRespawns(TIME);
    foodSpatialHash = buildFoodSpatialHash();
    agentSpatialHash = buildAgentSpatialHash(population, alive);
    buildObservationBatch(population, alive);
    evaluateControllerBatch(population, alive);
    const actionBatch = selectActions(population, alive);
    renderActiveFoods();
    drawHud();
    showStatus();
    for (let i = 0; i < population.length; i += 1) {
        if (!alive[i]) {
            continue;
        }
        const agent = population[i];
        const visibleR = clampNumber(80 + (agent.r / 255) * 175, 0, 255);
        const visibleG = clampNumber(80 + (agent.g / 255) * 175, 0, 255);
        const visibleB = clampNumber(80 + (agent.b / 255) * 175, 0, 255);
        stroke(255, 255, 255, 180);
        strokeWeight(1);
        fill(visibleR, visibleG, visibleB, 235);
        circle(agent.x, agent.y, agent.size * 2);
        agent.move(TIME, actionBatch[i]);
        agent.turn();
        const stillAlive = !agent.is_dead();
        if (!stillAlive && alive[i]) {
            if (agent.starved) {
                starvationDeathsThisGeneration += 1;
            }
            else {
                timeoutDeathsThisGeneration += 1;
            }
        }
        alive[i] = stillAlive;
    }
    if (!alive.some(Boolean)) {
        finalizeGeneration();
    }
}
function updateBestStats() {
    for (let i = 0; i < population.length; i += 1) {
        const fitness = population[i].dna.fitness;
        if (fitness <= MAX_LEN_LAST_EPISODE) {
            continue;
        }
        if (fitness > MAX_LEN) {
            MAX_LEN = round2(fitness);
            if (MAX_LEN > LIFE) {
                LIFE = Math.min(MAX_LIFE, LIFE * 2);
            }
        }
        else {
            MAX_LEN_LAST_EPISODE = round2(fitness);
        }
    }
}
function computeDiversity(pop) {
    if (pop.length === 0) {
        return {
            meanGeneStdDev: 0,
            perGeneStdDev: arrayOfN(DNA_GENE_COUNT, 0),
        };
    }
    const perGeneStdDev = [];
    for (let g = 0; g < DNA_GENE_COUNT; g += 1) {
        let mean = 0;
        for (let i = 0; i < pop.length; i += 1) {
            mean += pop[i].dna.genes[g];
        }
        mean /= pop.length;
        let variance = 0;
        for (let i = 0; i < pop.length; i += 1) {
            const diff = pop[i].dna.genes[g] - mean;
            variance += diff * diff;
        }
        variance /= pop.length;
        perGeneStdDev.push(Math.sqrt(variance));
    }
    const meanGeneStdDev = perGeneStdDev.reduce((acc, value) => acc + value, 0) / Math.max(1, perGeneStdDev.length);
    return {
        meanGeneStdDev: round2(meanGeneStdDev),
        perGeneStdDev: perGeneStdDev.map((v) => round2(v)),
    };
}
function computeFoodPatchMetrics() {
    if (!foodSystem || !foodTopology) {
        return {
            epochId: 0,
            activePatchCountEnd: 0,
            depletedPatchCount: 0,
            patchDormantCount: 0,
            patchRelocatedCount: 0,
            patchMeanActiveFraction: 0,
            patchTurnoverRate: 0,
            meanNearestPatchDistance: 0,
            patchConsumptionCounts: [],
            topPatchConsumptionShare: 0,
            patchConsumptionEntropy: 0,
        };
    }
    const patchConsumptionCounts = foodSystem.patches.map((patch) => patch.consumedThisGeneration);
    const activePatchCountEnd = foodSystem.patches.filter((patch) => patch.activeUnitCount > 0).length;
    const depletedPatchCount = foodSystem.patches.length - activePatchCountEnd;
    const patchDormantCount = foodSystem.patches.filter((patch) => isPatchDormant(patch, TIME)).length;
    const patchRelocatedCount = foodSystem.patches.filter((patch) => patch.relocatedThisGeneration).length;
    const totalTurnover = foodSystem.patches.reduce((acc, patch) => acc + patch.turnoverThisGeneration, 0);
    const patchMeanActiveFraction = foodSystem.patches.reduce((acc, patch, patchIdx) => {
        return acc + patch.activeUnitCount / Math.max(1, foodTopology.patches[patchIdx].slotCount);
    }, 0) / Math.max(1, foodSystem.patches.length);
    const totalConsumed = patchConsumptionCounts.reduce((acc, value) => acc + value, 0);
    let meanNearestPatchDistance = 0;
    if (foodTopology.patches.length > 1) {
        let totalNearestDistance = 0;
        for (let i = 0; i < foodTopology.patches.length; i += 1) {
            let nearestDistanceSq = Number.POSITIVE_INFINITY;
            for (let j = 0; j < foodTopology.patches.length; j += 1) {
                if (i === j) {
                    continue;
                }
                const dx = foodTopology.patches[i].cx - foodTopology.patches[j].cx;
                const dy = foodTopology.patches[i].cy - foodTopology.patches[j].cy;
                const distSq = dx * dx + dy * dy;
                if (distSq < nearestDistanceSq) {
                    nearestDistanceSq = distSq;
                }
            }
            if (nearestDistanceSq < Number.POSITIVE_INFINITY) {
                totalNearestDistance += Math.sqrt(nearestDistanceSq);
            }
        }
        meanNearestPatchDistance = totalNearestDistance / foodTopology.patches.length;
    }
    let topPatchConsumptionShare = 0;
    let patchConsumptionEntropy = 0;
    if (totalConsumed > 0) {
        topPatchConsumptionShare = Math.max(...patchConsumptionCounts) / totalConsumed;
        for (let i = 0; i < patchConsumptionCounts.length; i += 1) {
            if (patchConsumptionCounts[i] <= 0) {
                continue;
            }
            const probability = patchConsumptionCounts[i] / totalConsumed;
            patchConsumptionEntropy -= probability * Math.log(probability);
        }
        if (patchConsumptionCounts.length > 1) {
            patchConsumptionEntropy /= Math.log(patchConsumptionCounts.length);
        }
    }
    return {
        epochId: currentFoodEpochId,
        activePatchCountEnd,
        depletedPatchCount,
        patchDormantCount,
        patchRelocatedCount,
        patchMeanActiveFraction: round2(patchMeanActiveFraction),
        patchTurnoverRate: round2(totalTurnover / Math.max(1, countTotalFoodUnits())),
        meanNearestPatchDistance: round2(meanNearestPatchDistance),
        patchConsumptionCounts: patchConsumptionCounts.slice(),
        topPatchConsumptionShare: round2(topPatchConsumptionShare),
        patchConsumptionEntropy: round2(patchConsumptionEntropy),
    };
}
function recordGenerationTelemetry(pop) {
    if (pop.length === 0) {
        return;
    }
    const fitnessValues = pop.map((agent) => agent.dna.fitness);
    const bestFitness = Math.max(...fitnessValues);
    const worstFitness = Math.min(...fitnessValues);
    const meanFitness = fitnessValues.reduce((acc, value) => acc + value, 0) / fitnessValues.length;
    const meanLifeRemaining = pop.reduce((acc, agent) => acc + Math.max(0, agent.life), 0) / Math.max(1, pop.length);
    const foodsConsumedTotal = foodSystem ? foodSystem.consumedThisGeneration : 0;
    const foodsConsumedMeanPerAgent = foodsConsumedTotal / Math.max(1, NUM_AGENTS);
    const respawnCount = foodSystem ? foodSystem.respawnedThisGeneration : 0;
    const activeFoodEndCount = countActiveFoodUnits();
    const diagnostics = computePopulationDiagnostics(pop);
    const diversity = computeDiversity(pop);
    const foodPatchMetrics = computeFoodPatchMetrics();
    const observationMeans = getGenerationObservationMeans();
    runTelemetry.generations.push({
        gen: gen_num,
        bestFitness: round2(bestFitness),
        meanFitness: round2(meanFitness),
        worstFitness: round2(worstFitness),
        selectionStrategy: activeConfig.selectionStrategy,
        eliteCount: activeConfig.eliteCount,
        mutationRate: activeConfig.mutationRate,
        foodsConsumedTotal,
        foodsConsumedMeanPerAgent: round2(foodsConsumedMeanPerAgent),
        respawnCount,
        activeFoodEndCount,
        meanLifeRemaining: round2(meanLifeRemaining),
        epochId: foodPatchMetrics.epochId,
        meanEnergyRemaining: diagnostics.meanEnergyRemaining,
        minEnergyRemaining: diagnostics.minEnergyRemaining,
        maxEnergyRemaining: diagnostics.maxEnergyRemaining,
        starvationDeaths: starvationDeathsThisGeneration,
        timeoutDeaths: timeoutDeathsThisGeneration,
        meanSpeedTrait: diagnostics.meanSpeedTrait,
        meanSizeTrait: diagnostics.meanSizeTrait,
        speedTraitStdDev: diagnostics.speedTraitStdDev,
        sizeTraitStdDev: diagnostics.sizeTraitStdDev,
        meanVisionRadius: diagnostics.meanVisionRadius,
        visionRadiusStdDev: diagnostics.visionRadiusStdDev,
        controllerWeightStdDev: diagnostics.controllerWeightStdDev,
        directionChoiceEntropy: computeDirectionChoiceEntropy(),
        meanObservedFoodDensity: observationMeans.meanObservedFoodDensity,
        meanObservedAgentDensity: observationMeans.meanObservedAgentDensity,
        aliveFramesMean: diagnostics.aliveFramesMean,
        fastAgentCount: diagnostics.fastAgentCount,
        slowAgentCount: diagnostics.slowAgentCount,
        largeAgentCount: diagnostics.largeAgentCount,
        smallAgentCount: diagnostics.smallAgentCount,
        activePatchCountEnd: foodPatchMetrics.activePatchCountEnd,
        depletedPatchCount: foodPatchMetrics.depletedPatchCount,
        patchDormantCount: foodPatchMetrics.patchDormantCount,
        patchRelocatedCount: foodPatchMetrics.patchRelocatedCount,
        patchMeanActiveFraction: foodPatchMetrics.patchMeanActiveFraction,
        patchTurnoverRate: foodPatchMetrics.patchTurnoverRate,
        meanNearestPatchDistance: foodPatchMetrics.meanNearestPatchDistance,
        patchConsumptionCounts: foodPatchMetrics.patchConsumptionCounts,
        topPatchConsumptionShare: foodPatchMetrics.topPatchConsumptionShare,
        patchConsumptionEntropy: foodPatchMetrics.patchConsumptionEntropy,
        meanGeneStdDev: diversity.meanGeneStdDev,
        perGeneStdDev: diversity.perGeneStdDev,
    });
}
function finalizeGeneration() {
    updateBestStats();
    recordGenerationTelemetry(population);
    if (gen_num >= activeConfig.maxGenerations) {
        const telemetryFilename = exportTelemetry(true);
        if (benchmarkSuiteState) {
            advanceBenchmarkSuite(telemetryFilename);
            return;
        }
        runFinished = true;
        noLoop();
        return;
    }
    population = algorithm(population);
    alive = arrayOfN(NUM_AGENTS, true);
    resetFoodGenerationCounters();
    resetGenerationObservationMetrics();
    gen_num += 1;
    starvationDeathsThisGeneration = 0;
    timeoutDeathsThisGeneration = 0;
    clear();
    refreshEnvironment();
    maybeAdvanceFoodEpoch();
}
function saveEnv() {
    const frozenRngState = getRngState();
    const topologySnapshot = foodTopology ? cloneFoodTopology(foodTopology) : createFoodTopology();
    const runtimeSnapshot = foodSystem ? cloneFoodSystem(foodSystem) : createFoodSystemFromTopology(topologySnapshot);
    setRngState(frozenRngState);
    const payload = {
        version: SAVE_SCHEMA_VERSION,
        controller_arch: CONTROLLER_ARCH,
        gene_layout: buildGeneLayoutMetadata(),
        seed: activeSeed,
        config: cloneConfig(activeConfig),
        rng_state: getRngState(),
        gen_num,
        time: TIME,
        life: LIFE,
        max_life: MAX_LIFE,
        num_agents: NUM_AGENTS,
        max_len: MAX_LEN,
        max_len_last_episode: MAX_LEN_LAST_EPISODE,
        population_dna: population.map((agent) => agent.dna.genes.slice()),
        food_system: serializeFoodSystem(topologySnapshot, runtimeSnapshot),
        telemetry: runTelemetry,
    };
    emitJsonExport(payload, `saved_environment_v8_gen${gen_num}.json`);
    statusMessage = `Saved generation ${gen_num} (schema v${SAVE_SCHEMA_VERSION}).`;
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function isSelectionStrategy(value) {
    return value === "rank" || value === "roulette" || value === "tournament" || value === "truncation";
}
function parseConfig(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error("Invalid or missing config object.");
    }
    const record = raw;
    const requiredNumbers = [
        "seed",
        "maxGenerations",
        "populationSize",
        "mutationRate",
        "eliteCount",
        "rankRetainBestPct",
        "rankRetainRandomPct",
        "tournamentK",
        "truncationTopPct",
        "foodPatchCount",
        "foodPatchMinSeparation",
        "foodPatchMinRadius",
        "foodPatchMaxRadius",
        "foodPatchMinUnits",
        "foodPatchMaxUnits",
        "foodPatchRegenDelayFrames",
        "foodPatchRegenBatchSize",
        "foodConsumeRadius",
        "foodUnitEnergyReward",
        "foodEpochLengthGenerations",
        "foodPatchRelocationFractionPerEpoch",
        "foodPatchDriftRadius",
        "foodPatchDormancyThreshold",
        "foodPatchDormancyDelayFrames",
        "foodPatchRecoveryBatchMultiplier",
        "foodPatchSeasonalAmplitude",
        "foodPatchSeasonalPeriodGenerations",
        "initialEnergy",
        "maxEnergy",
        "basalEnergyDrain",
        "speedEnergyCoeff",
        "sizeEnergyCoeff",
        "minSpeed",
        "maxSpeed",
        "minSize",
        "maxSize",
        "baseVisionRadius",
        "minVisionRadius",
        "maxVisionRadius",
        "sizeVisionCoeff",
        "speedVisionCoeff",
        "visionEnergyCoeff",
        "observationSectorCount",
        "controllerWeightMutationSigma",
    ];
    for (let i = 0; i < requiredNumbers.length; i += 1) {
        const key = requiredNumbers[i];
        if (!isFiniteNumber(record[key])) {
            throw new Error(`Invalid config field: ${key}`);
        }
    }
    if (!isSelectionStrategy(record.selectionStrategy)) {
        throw new Error("Invalid config field: selectionStrategy");
    }
    if (record.foodLayoutMode !== "clustered_patches") {
        throw new Error("Invalid config field: foodLayoutMode");
    }
    if (record.foodSlotRespawnMode !== "random_within_patch") {
        throw new Error("Invalid config field: foodSlotRespawnMode");
    }
    if (record.controllerArch !== CONTROLLER_ARCH) {
        throw new Error("Invalid config field: controllerArch");
    }
    if (typeof record.useBackgroundFitness !== "boolean") {
        throw new Error("Invalid config field: useBackgroundFitness");
    }
    return normalizeConfig({
        seed: record.seed,
        maxGenerations: record.maxGenerations,
        populationSize: record.populationSize,
        mutationRate: record.mutationRate,
        selectionStrategy: record.selectionStrategy,
        eliteCount: record.eliteCount,
        rankRetainBestPct: record.rankRetainBestPct,
        rankRetainRandomPct: record.rankRetainRandomPct,
        tournamentK: record.tournamentK,
        truncationTopPct: record.truncationTopPct,
        foodLayoutMode: record.foodLayoutMode,
        foodPatchCount: record.foodPatchCount,
        foodPatchMinSeparation: record.foodPatchMinSeparation,
        foodPatchMinRadius: record.foodPatchMinRadius,
        foodPatchMaxRadius: record.foodPatchMaxRadius,
        foodPatchMinUnits: record.foodPatchMinUnits,
        foodPatchMaxUnits: record.foodPatchMaxUnits,
        foodPatchRegenDelayFrames: record.foodPatchRegenDelayFrames,
        foodPatchRegenBatchSize: record.foodPatchRegenBatchSize,
        foodConsumeRadius: record.foodConsumeRadius,
        foodUnitEnergyReward: record.foodUnitEnergyReward,
        foodEpochLengthGenerations: record.foodEpochLengthGenerations,
        foodPatchRelocationFractionPerEpoch: record.foodPatchRelocationFractionPerEpoch,
        foodPatchDriftRadius: record.foodPatchDriftRadius,
        foodSlotRespawnMode: record.foodSlotRespawnMode,
        foodPatchDormancyThreshold: record.foodPatchDormancyThreshold,
        foodPatchDormancyDelayFrames: record.foodPatchDormancyDelayFrames,
        foodPatchRecoveryBatchMultiplier: record.foodPatchRecoveryBatchMultiplier,
        foodPatchSeasonalAmplitude: record.foodPatchSeasonalAmplitude,
        foodPatchSeasonalPeriodGenerations: record.foodPatchSeasonalPeriodGenerations,
        initialEnergy: record.initialEnergy,
        maxEnergy: record.maxEnergy,
        basalEnergyDrain: record.basalEnergyDrain,
        speedEnergyCoeff: record.speedEnergyCoeff,
        sizeEnergyCoeff: record.sizeEnergyCoeff,
        minSpeed: record.minSpeed,
        maxSpeed: record.maxSpeed,
        minSize: record.minSize,
        maxSize: record.maxSize,
        baseVisionRadius: record.baseVisionRadius,
        minVisionRadius: record.minVisionRadius,
        maxVisionRadius: record.maxVisionRadius,
        sizeVisionCoeff: record.sizeVisionCoeff,
        speedVisionCoeff: record.speedVisionCoeff,
        visionEnergyCoeff: record.visionEnergyCoeff,
        observationSectorCount: record.observationSectorCount,
        controllerArch: record.controllerArch,
        controllerWeightMutationSigma: record.controllerWeightMutationSigma,
        useBackgroundFitness: record.useBackgroundFitness,
    });
}
function parseRunTelemetry(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error("Invalid or missing telemetry object.");
    }
    const record = raw;
    if (!isFiniteNumber(record.schema_version)) {
        throw new Error("Invalid telemetry field: schema_version");
    }
    if (!isFiniteNumber(record.seed)) {
        throw new Error("Invalid telemetry field: seed");
    }
    if (typeof record.started_at !== "string") {
        throw new Error("Invalid telemetry field: started_at");
    }
    if (!(typeof record.preset_name === "string" || record.preset_name === undefined)) {
        throw new Error("Invalid telemetry field: preset_name");
    }
    if (!(Array.isArray(record.benchmark_seed_suite) || record.benchmark_seed_suite === null || record.benchmark_seed_suite === undefined)) {
        throw new Error("Invalid telemetry field: benchmark_seed_suite");
    }
    if (!(typeof record.completed_at === "string" || record.completed_at === null)) {
        throw new Error("Invalid telemetry field: completed_at");
    }
    if (typeof record.auto_exported !== "boolean") {
        throw new Error("Invalid telemetry field: auto_exported");
    }
    if (!Array.isArray(record.generations)) {
        throw new Error("Invalid telemetry field: generations");
    }
    const config = parseConfig(record.config);
    const generations = record.generations.map((entry, idx) => {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
            throw new Error(`Invalid telemetry generation entry at index ${idx}`);
        }
        const genRecord = entry;
        const numericFields = [
            "gen",
            "bestFitness",
            "meanFitness",
            "worstFitness",
            "eliteCount",
            "mutationRate",
            "foodsConsumedTotal",
            "foodsConsumedMeanPerAgent",
            "respawnCount",
            "activeFoodEndCount",
            "epochId",
            "activePatchCountEnd",
            "depletedPatchCount",
            "patchDormantCount",
            "patchRelocatedCount",
            "patchMeanActiveFraction",
            "patchTurnoverRate",
            "meanNearestPatchDistance",
            "topPatchConsumptionShare",
            "patchConsumptionEntropy",
            "meanLifeRemaining",
            "meanGeneStdDev",
        ];
        for (let i = 0; i < numericFields.length; i += 1) {
            const key = numericFields[i];
            if (!isFiniteNumber(genRecord[key])) {
                throw new Error(`Invalid telemetry generation field ${key} at index ${idx}`);
            }
        }
        if (!isSelectionStrategy(genRecord.selectionStrategy)) {
            throw new Error(`Invalid telemetry selectionStrategy at index ${idx}`);
        }
        const optionalNumericFields = [
            "meanEnergyRemaining",
            "minEnergyRemaining",
            "maxEnergyRemaining",
            "starvationDeaths",
            "timeoutDeaths",
            "meanSpeedTrait",
            "meanSizeTrait",
            "speedTraitStdDev",
            "sizeTraitStdDev",
            "meanVisionRadius",
            "visionRadiusStdDev",
            "controllerWeightStdDev",
            "directionChoiceEntropy",
            "meanObservedFoodDensity",
            "meanObservedAgentDensity",
            "aliveFramesMean",
            "fastAgentCount",
            "slowAgentCount",
            "largeAgentCount",
            "smallAgentCount",
        ];
        for (let i = 0; i < optionalNumericFields.length; i += 1) {
            const key = optionalNumericFields[i];
            if (!(genRecord[key] === undefined || isFiniteNumber(genRecord[key]))) {
                throw new Error(`Invalid telemetry generation field ${key} at index ${idx}`);
            }
        }
        if (!Array.isArray(genRecord.patchConsumptionCounts) || genRecord.patchConsumptionCounts.length !== config.foodPatchCount) {
            throw new Error(`Invalid telemetry patchConsumptionCounts at index ${idx}`);
        }
        const patchConsumptionCounts = genRecord.patchConsumptionCounts.map((value, patchIdx) => {
            if (!isFiniteNumber(value)) {
                throw new Error(`Invalid telemetry patchConsumptionCounts value at generation ${idx}, patch ${patchIdx}`);
            }
            return value;
        });
        if (!Array.isArray(genRecord.perGeneStdDev) || genRecord.perGeneStdDev.length !== DNA_GENE_COUNT) {
            throw new Error(`Invalid telemetry perGeneStdDev at index ${idx}`);
        }
        const perGeneStdDev = genRecord.perGeneStdDev.map((value, geneIdx) => {
            if (!isFiniteNumber(value)) {
                throw new Error(`Invalid telemetry perGeneStdDev value at generation ${idx}, gene ${geneIdx}`);
            }
            return value;
        });
        return {
            gen: genRecord.gen,
            bestFitness: genRecord.bestFitness,
            meanFitness: genRecord.meanFitness,
            worstFitness: genRecord.worstFitness,
            selectionStrategy: genRecord.selectionStrategy,
            eliteCount: genRecord.eliteCount,
            mutationRate: genRecord.mutationRate,
            foodsConsumedTotal: genRecord.foodsConsumedTotal,
            foodsConsumedMeanPerAgent: genRecord.foodsConsumedMeanPerAgent,
            respawnCount: genRecord.respawnCount,
            activeFoodEndCount: genRecord.activeFoodEndCount,
            epochId: genRecord.epochId,
            activePatchCountEnd: genRecord.activePatchCountEnd,
            depletedPatchCount: genRecord.depletedPatchCount,
            patchDormantCount: genRecord.patchDormantCount,
            patchRelocatedCount: genRecord.patchRelocatedCount,
            patchMeanActiveFraction: genRecord.patchMeanActiveFraction,
            patchTurnoverRate: genRecord.patchTurnoverRate,
            meanNearestPatchDistance: genRecord.meanNearestPatchDistance,
            patchConsumptionCounts,
            topPatchConsumptionShare: genRecord.topPatchConsumptionShare,
            patchConsumptionEntropy: genRecord.patchConsumptionEntropy,
            meanLifeRemaining: genRecord.meanLifeRemaining,
            meanEnergyRemaining: genRecord.meanEnergyRemaining ?? 0,
            minEnergyRemaining: genRecord.minEnergyRemaining ?? 0,
            maxEnergyRemaining: genRecord.maxEnergyRemaining ?? 0,
            starvationDeaths: genRecord.starvationDeaths ?? 0,
            timeoutDeaths: genRecord.timeoutDeaths ?? 0,
            meanSpeedTrait: genRecord.meanSpeedTrait ?? 0,
            meanSizeTrait: genRecord.meanSizeTrait ?? 0,
            speedTraitStdDev: genRecord.speedTraitStdDev ?? 0,
            sizeTraitStdDev: genRecord.sizeTraitStdDev ?? 0,
            meanVisionRadius: genRecord.meanVisionRadius ?? 0,
            visionRadiusStdDev: genRecord.visionRadiusStdDev ?? 0,
            controllerWeightStdDev: genRecord.controllerWeightStdDev ?? 0,
            directionChoiceEntropy: genRecord.directionChoiceEntropy ?? 0,
            meanObservedFoodDensity: genRecord.meanObservedFoodDensity ?? 0,
            meanObservedAgentDensity: genRecord.meanObservedAgentDensity ?? 0,
            aliveFramesMean: genRecord.aliveFramesMean ?? 0,
            fastAgentCount: genRecord.fastAgentCount ?? 0,
            slowAgentCount: genRecord.slowAgentCount ?? 0,
            largeAgentCount: genRecord.largeAgentCount ?? 0,
            smallAgentCount: genRecord.smallAgentCount ?? 0,
            meanGeneStdDev: genRecord.meanGeneStdDev,
            perGeneStdDev,
        };
    });
    return {
        schema_version: record.schema_version,
        seed: record.seed,
        preset_name: record.preset_name ?? CUSTOM_EXPERIMENT_PRESET,
        benchmark_seed_suite: Array.isArray(record.benchmark_seed_suite)
            ? record.benchmark_seed_suite.slice()
            : null,
        config,
        started_at: record.started_at,
        completed_at: record.completed_at,
        auto_exported: record.auto_exported,
        generations,
    };
}
function parseFoodSystem(raw, expectedPatchCount) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error("Invalid or missing food_system object.");
    }
    const record = raw;
    if (record.layout_mode !== "clustered_patches") {
        throw new Error("Invalid food_system field: layout_mode");
    }
    if (typeof record.topology !== "object" || record.topology === null || Array.isArray(record.topology)) {
        throw new Error("Invalid food_system field: topology");
    }
    if (typeof record.runtime !== "object" || record.runtime === null || Array.isArray(record.runtime)) {
        throw new Error("Invalid food_system field: runtime");
    }
    if (!Array.isArray(record.topology.patches)) {
        throw new Error("Invalid food_system topology field: patches");
    }
    if (!Array.isArray(record.runtime.patches)) {
        throw new Error("Invalid food_system runtime field: patches");
    }
    if (!isFiniteNumber(record.topology.epoch_length_generations)) {
        throw new Error("Invalid food_system topology field: epoch_length_generations");
    }
    if (!isFiniteNumber(record.runtime.epoch_id)) {
        throw new Error("Invalid food_system runtime field: epoch_id");
    }
    if (!isFiniteNumber(record.runtime.consumed_this_generation)) {
        throw new Error("Invalid food_system runtime field: consumed_this_generation");
    }
    if (!isFiniteNumber(record.runtime.respawned_this_generation)) {
        throw new Error("Invalid food_system runtime field: respawned_this_generation");
    }
    if (record.topology.patches.length !== expectedPatchCount) {
        throw new Error(`food_system topology patches length (${record.topology.patches.length}) != config.foodPatchCount (${expectedPatchCount}).`);
    }
    if (record.runtime.patches.length !== expectedPatchCount) {
        throw new Error(`food_system runtime patches length (${record.runtime.patches.length}) != config.foodPatchCount (${expectedPatchCount}).`);
    }
    const topology = {
        layoutMode: record.layout_mode,
        epochLengthGenerations: Math.max(1, Math.floor(record.topology.epoch_length_generations)),
        patches: record.topology.patches.map((entry, patchIndex) => {
            if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
                throw new Error(`Invalid food topology patch at index ${patchIndex}`);
            }
            if (!isFiniteNumber(entry.id) ||
                !isFiniteNumber(entry.cx) ||
                !isFiniteNumber(entry.cy) ||
                !isFiniteNumber(entry.radius) ||
                !isFiniteNumber(entry.richness_multiplier) ||
                !isFiniteNumber(entry.quality_multiplier) ||
                !isFiniteNumber(entry.regen_delay_multiplier) ||
                !isFiniteNumber(entry.capacity_multiplier) ||
                !isFiniteNumber(entry.regen_delay_frames) ||
                !isFiniteNumber(entry.seasonal_phase) ||
                !isFiniteNumber(entry.slot_count)) {
                throw new Error(`Invalid food topology patch fields at index ${patchIndex}`);
            }
            return {
                id: Math.floor(entry.id),
                cx: entry.cx,
                cy: entry.cy,
                radius: entry.radius,
                richnessMultiplier: entry.richness_multiplier,
                qualityMultiplier: entry.quality_multiplier,
                regenDelayMultiplier: entry.regen_delay_multiplier,
                capacityMultiplier: entry.capacity_multiplier,
                regenDelayFrames: Math.max(1, Math.floor(entry.regen_delay_frames)),
                seasonalPhase: entry.seasonal_phase,
                slotCount: Math.max(1, Math.floor(entry.slot_count)),
            };
        }),
    };
    const runtime = {
        epochId: Math.max(0, Math.floor(record.runtime.epoch_id)),
        patches: record.runtime.patches.map((entry, patchIndex) => {
            if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
                throw new Error(`Invalid food runtime patch at index ${patchIndex}`);
            }
            const topologyPatch = topology.patches[patchIndex];
            if (!topologyPatch) {
                throw new Error(`Missing topology patch for runtime patch ${patchIndex}`);
            }
            if (!isFiniteNumber(entry.id) ||
                !isFiniteNumber(entry.active_unit_count) ||
                !isFiniteNumber(entry.consumed_this_generation) ||
                !isFiniteNumber(entry.dormant_until_frame) ||
                !isFiniteNumber(entry.respawn_accumulator) ||
                typeof entry.relocated_this_generation !== "boolean" ||
                !isFiniteNumber(entry.turnover_this_generation) ||
                !Array.isArray(entry.slots)) {
                throw new Error(`Invalid food runtime patch fields at index ${patchIndex}`);
            }
            if (entry.slots.length !== topologyPatch.slotCount) {
                throw new Error(`food runtime slots length (${entry.slots.length}) != topology slot_count (${topologyPatch.slotCount}) at patch ${patchIndex}`);
            }
            const slots = entry.slots.map((slot, slotIndex) => {
                if (typeof slot !== "object" || slot === null || Array.isArray(slot)) {
                    throw new Error(`Invalid food runtime slot at patch ${patchIndex}, slot ${slotIndex}`);
                }
                if (!isFiniteNumber(slot.slot_id) ||
                    !isFiniteNumber(slot.x) ||
                    !isFiniteNumber(slot.y) ||
                    typeof slot.active !== "boolean" ||
                    !isFiniteNumber(slot.respawn_at_frame)) {
                    throw new Error(`Invalid food runtime slot fields at patch ${patchIndex}, slot ${slotIndex}`);
                }
                return {
                    slotId: Math.floor(slot.slot_id),
                    x: slot.x,
                    y: slot.y,
                    active: slot.active,
                    respawnAtFrame: Math.floor(slot.respawn_at_frame),
                };
            });
            const activeUnitCount = Math.max(0, Math.floor(entry.active_unit_count));
            if (activeUnitCount > slots.length) {
                throw new Error(`food runtime active_unit_count (${activeUnitCount}) exceeds slot count (${slots.length}) at patch ${patchIndex}`);
            }
            const activeSlotCount = slots.filter((slot) => slot.active).length;
            if (activeUnitCount !== activeSlotCount) {
                throw new Error(`food runtime active_unit_count (${activeUnitCount}) != active slot count (${activeSlotCount}) at patch ${patchIndex}`);
            }
            return {
                id: Math.floor(entry.id),
                activeUnitCount,
                consumedThisGeneration: Math.max(0, Math.floor(entry.consumed_this_generation)),
                dormantUntilFrame: Math.floor(entry.dormant_until_frame),
                respawnAccumulator: Math.max(0, entry.respawn_accumulator),
                relocatedThisGeneration: entry.relocated_this_generation,
                turnoverThisGeneration: Math.max(0, Math.floor(entry.turnover_this_generation)),
                slots,
            };
        }),
        consumedThisGeneration: Math.max(0, Math.floor(record.runtime.consumed_this_generation)),
        respawnedThisGeneration: Math.max(0, Math.floor(record.runtime.respawned_this_generation)),
    };
    return {
        topology,
        runtime,
    };
}
function parseGeneLayout(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error("Invalid or missing gene_layout object.");
    }
    const expected = buildGeneLayoutMetadata();
    const serializedExpected = JSON.stringify(expected);
    const serializedActual = JSON.stringify(raw);
    if (serializedActual !== serializedExpected) {
        throw new Error("Unsupported gene_layout metadata.");
    }
    return expected;
}
function parseLoadedFile(file) {
    if (!file || file.data === undefined || file.data === null) {
        throw new Error("Selected file is empty or unreadable.");
    }
    let raw = file.data;
    if (typeof raw === "string") {
        raw = JSON.parse(raw);
    }
    return validateSavedEnvironment(raw);
}
function validateSavedEnvironment(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error("Invalid save file: root value must be an object.");
    }
    const record = raw;
    if (record.version !== SAVE_SCHEMA_VERSION) {
        throw new Error(`Unsupported schema version. Expected ${SAVE_SCHEMA_VERSION}.`);
    }
    if (record.controller_arch !== CONTROLLER_ARCH) {
        throw new Error(`Unsupported controller architecture. Expected ${CONTROLLER_ARCH}.`);
    }
    const config = parseConfig(record.config);
    const geneLayout = parseGeneLayout(record.gene_layout);
    const numericKeys = [
        "seed",
        "rng_state",
        "gen_num",
        "time",
        "life",
        "max_life",
        "num_agents",
        "max_len",
        "max_len_last_episode",
    ];
    for (let i = 0; i < numericKeys.length; i += 1) {
        const key = numericKeys[i];
        if (!isFiniteNumber(record[key])) {
            throw new Error(`Invalid or missing numeric field: ${key}`);
        }
    }
    const numAgents = Math.max(1, Math.floor(record.num_agents));
    if (numAgents !== config.populationSize) {
        throw new Error(`num_agents (${numAgents}) must match config.populationSize (${config.populationSize}).`);
    }
    const rawDna = record.population_dna;
    if (!Array.isArray(rawDna)) {
        throw new Error("Invalid or missing field: population_dna");
    }
    if (rawDna.length !== numAgents) {
        throw new Error(`population_dna length (${rawDna.length}) != num_agents (${numAgents}).`);
    }
    const populationDna = rawDna.map((dnaRow, rowIndex) => {
        if (!Array.isArray(dnaRow) || dnaRow.length !== DNA_GENE_COUNT) {
            throw new Error(`Invalid DNA row at index ${rowIndex}. Expected ${DNA_GENE_COUNT} genes.`);
        }
        return dnaRow.map((value, geneIndex) => {
            if (!isFiniteNumber(value)) {
                throw new Error(`Invalid gene value at row ${rowIndex}, index ${geneIndex}.`);
            }
            return value;
        });
    });
    const foodSystemState = parseFoodSystem(record.food_system, config.foodPatchCount);
    if (foodSystemState.topology.epochLengthGenerations !== config.foodEpochLengthGenerations) {
        throw new Error(`food_system epoch_length_generations (${foodSystemState.topology.epochLengthGenerations}) must match config.foodEpochLengthGenerations (${config.foodEpochLengthGenerations}).`);
    }
    const telemetry = parseRunTelemetry(record.telemetry);
    return {
        version: SAVE_SCHEMA_VERSION,
        controller_arch: CONTROLLER_ARCH,
        gene_layout: geneLayout,
        seed: record.seed,
        config,
        rng_state: record.rng_state,
        gen_num: Math.max(1, Math.floor(record.gen_num)),
        time: Math.max(0, Math.floor(record.time)),
        life: Math.max(1, Math.floor(record.life)),
        max_life: Math.max(1, Math.floor(record.max_life)),
        num_agents: numAgents,
        max_len: record.max_len,
        max_len_last_episode: record.max_len_last_episode,
        population_dna: populationDna,
        food_system: foodSystemState,
        telemetry,
    };
}
function applySavedEnvironment(payload) {
    applyConfig(payload.config);
    activePresetName = payload.telemetry && payload.telemetry.preset_name
        ? payload.telemetry.preset_name
        : inferPresetNameFromConfig(payload.config);
    activeSeed = Math.floor(payload.seed);
    setRngState(payload.rng_state);
    gen_num = payload.gen_num;
    LIFE = payload.life;
    MAX_LIFE = payload.max_life;
    NUM_AGENTS = payload.num_agents;
    MAX_LEN = payload.max_len;
    MAX_LEN_LAST_EPISODE = payload.max_len_last_episode;
    population = createPopulation(NUM_AGENTS, payload.population_dna);
    alive = arrayOfN(NUM_AGENTS, true);
    ensureControllerStateBatch(NUM_AGENTS);
    TIME = payload.time;
    foodTopology = cloneFoodTopology(payload.food_system.topology);
    foodSystem = cloneFoodSystem(payload.food_system.runtime);
    foodSpatialHash = null;
    agentSpatialHash = null;
    currentFoodEpochId = foodSystem.epochId;
    runTelemetry = payload.telemetry;
    runFinished = false;
    starvationDeathsThisGeneration = 0;
    timeoutDeathsThisGeneration = 0;
    resetGenerationObservationMetrics();
    benchmarkSuiteState = null;
    loop();
    clear();
    const frozenRngState = getRngState();
    refreshEnvironment();
    setRngState(frozenRngState);
}
function onLoadFile(file) {
    try {
        const payload = parseLoadedFile(file);
        applySavedEnvironment(payload);
        statusMessage = `Loaded ${file.name} (schema v${SAVE_SCHEMA_VERSION}).`;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown load error";
        statusMessage = `Load failed: ${message}`;
        console.error(error);
    }
}
class DNA {
    constructor(genes = null, mutateOnInit = false) {
        if (Array.isArray(genes) && genes.length === DNA_GENE_COUNT) {
            this.genes = genes.slice();
            if (mutateOnInit) {
                this.mutate();
            }
        }
        else {
            this.genes = [];
            for (let i = 0; i < DNA_GENE_COUNT; i += 1) {
                if (i <= DNA_COLOR_GENE_LAST_INDEX) {
                    this.genes.push(DNA.randomColorGene());
                }
                else if (i === DNA_SPEED_GENE_INDEX || i === DNA_SIZE_GENE_INDEX) {
                    this.genes.push(DNA.randomTraitGene());
                }
                else {
                    this.genes.push(DNA.randomControllerGene());
                }
            }
        }
        this.fitness = 0;
    }
    static randomColorGene() {
        return range(0, 255);
    }
    static randomTraitGene() {
        return range(0, 1);
    }
    static randomControllerGene() {
        return range(-1, 1);
    }
    mutate() {
        for (let i = 0; i < this.genes.length; i += 1) {
            if (nextFloat() >= activeConfig.mutationRate) {
                continue;
            }
            if (i <= DNA_COLOR_GENE_LAST_INDEX) {
                this.genes[i] = DNA.randomColorGene();
            }
            else if (i === DNA_SPEED_GENE_INDEX || i === DNA_SIZE_GENE_INDEX) {
                this.genes[i] = DNA.randomTraitGene();
            }
            else {
                this.genes[i] = clampNumber(this.genes[i] + range(-activeConfig.controllerWeightMutationSigma, activeConfig.controllerWeightMutationSigma), -1, 1);
            }
        }
    }
}
class Ball {
    constructor(genes = null, mutateOnSpawn = false) {
        this.x = range(0, W);
        this.y = range(0, H);
        this.initial_x = this.x;
        this.initial_y = this.y;
        this.final_x = this.x;
        this.final_y = this.y;
        this.dna = new DNA(genes, mutateOnSpawn);
        this.life = LIFE;
        this.energy = activeConfig.initialEnergy;
        this.ageFrames = 0;
        this.starved = false;
        this.lastDx = 0;
        this.lastDy = 0;
        this.r = this.dna.genes[DNA_COLOR_GENE_FIRST_INDEX];
        this.g = this.dna.genes[DNA_COLOR_GENE_FIRST_INDEX + 1];
        this.b = this.dna.genes[DNA_COLOR_GENE_FIRST_INDEX + 2];
        this.speed = mapUnitGene(this.dna.genes[DNA_SPEED_GENE_INDEX], activeConfig.minSpeed, activeConfig.maxSpeed);
        this.size = mapUnitGene(this.dna.genes[DNA_SIZE_GENE_INDEX], activeConfig.minSize, activeConfig.maxSize);
        this.visionRadius = computeVisionRadiusFromTraits(getSizeTraitNorm(this), getSpeedTraitNorm(this));
        this.move_dir = 1;
    }
    move(currentFrame, selectedDirection) {
        this.move_dir = clampInt(selectedDirection, 1, 4);
        const direction = DIRECTIONS[this.move_dir];
        this.x += direction.dx * this.speed;
        this.y += direction.dy * this.speed;
        this.lastDx = direction.dx * this.speed;
        this.lastDy = direction.dy * this.speed;
        this.life -= 1;
        this.ageFrames += 1;
        const energyDrain = activeConfig.basalEnergyDrain +
            activeConfig.speedEnergyCoeff * this.speed * this.speed +
            activeConfig.sizeEnergyCoeff * this.size +
            activeConfig.visionEnergyCoeff * (this.visionRadius / Math.max(1, activeConfig.maxVisionRadius));
        this.energy = Math.max(0, this.energy - energyDrain);
        if (activeConfig.useBackgroundFitness && this.energy > 0) {
            const green = sampleGreen(this.x, this.y);
            this.energy = Math.min(activeConfig.maxEnergy, this.energy + 2 * green);
        }
        tryConsumeFood(this, currentFrame);
        this.dna.fitness = round2(this.ageFrames);
        if (this.is_dead()) {
            this.final_x = this.x;
            this.final_y = this.y;
            this.starved = this.energy <= 0;
        }
    }
    turn() {
        const oldX = this.x;
        const oldY = this.y;
        this.x = clampNumber(this.x, 1, width - 2);
        this.y = clampNumber(this.y, 1, height - 2);
        if (this.x !== oldX || this.y !== oldY) {
            this.life = Math.max(0, this.life - BOUNDARY_LIFE_PENALTY);
            this.energy = Math.max(0, this.energy - BOUNDARY_ENERGY_PENALTY);
            if (this.energy <= 0) {
                this.starved = true;
            }
        }
    }
    is_dead() {
        return this.life <= 0 || this.energy <= 0;
    }
    get_fitness() {
        return this.dna.fitness;
    }
}
function copyControllerHiddenBlock(childGenes, sourceGenes, hiddenIndex) {
    const start = DNA_CONTROLLER_GENE_FIRST_INDEX + hiddenIndex * CONTROLLER_HIDDEN_BLOCK_SIZE;
    for (let offset = 0; offset < CONTROLLER_HIDDEN_BLOCK_SIZE; offset += 1) {
        childGenes[start + offset] = sourceGenes[start + offset];
    }
}
function copyControllerOutputBiasBlock(childGenes, sourceGenes) {
    const start = DNA_CONTROLLER_GENE_FIRST_INDEX + CONTROLLER_HIDDEN_SIZE * CONTROLLER_HIDDEN_BLOCK_SIZE;
    for (let offset = 0; offset < CONTROLLER_OUTPUT_SIZE; offset += 1) {
        childGenes[start + offset] = sourceGenes[start + offset];
    }
}
function crossover(parentA, parentB) {
    const childGenes = arrayOfN(DNA_GENE_COUNT, 0);
    for (let i = DNA_COLOR_GENE_FIRST_INDEX; i <= DNA_COLOR_GENE_LAST_INDEX; i += 1) {
        childGenes[i] = nextFloat() < 0.5 ? parentA.dna.genes[i] : parentB.dna.genes[i];
    }
    childGenes[DNA_SPEED_GENE_INDEX] = nextFloat() < 0.5
        ? parentA.dna.genes[DNA_SPEED_GENE_INDEX]
        : parentB.dna.genes[DNA_SPEED_GENE_INDEX];
    childGenes[DNA_SIZE_GENE_INDEX] = nextFloat() < 0.5
        ? parentA.dna.genes[DNA_SIZE_GENE_INDEX]
        : parentB.dna.genes[DNA_SIZE_GENE_INDEX];
    for (let hiddenIndex = 0; hiddenIndex < CONTROLLER_HIDDEN_SIZE; hiddenIndex += 1) {
        if (nextFloat() < 0.5) {
            copyControllerHiddenBlock(childGenes, parentA.dna.genes, hiddenIndex);
        }
        else {
            copyControllerHiddenBlock(childGenes, parentB.dna.genes, hiddenIndex);
        }
    }
    if (nextFloat() < 0.5) {
        copyControllerOutputBiasBlock(childGenes, parentA.dna.genes);
    }
    else {
        copyControllerOutputBiasBlock(childGenes, parentB.dna.genes);
    }
    return childGenes;
}
function rankPopulationByFitness(chromosomes) {
    return chromosomes.slice().sort((a, b) => b.get_fitness() - a.get_fitness());
}
function pickByRank(chromosomes, count) {
    if (chromosomes.length === 0 || count <= 0) {
        return [];
    }
    const sorted = rankPopulationByFitness(chromosomes);
    const bestCount = clampInt(Math.floor(chromosomes.length * activeConfig.rankRetainBestPct), 1, chromosomes.length);
    const randomCount = clampInt(Math.floor(chromosomes.length * activeConfig.rankRetainRandomPct), 0, chromosomes.length - bestCount);
    const best = sorted.slice(0, bestCount);
    const remaining = shuffle(sorted.slice(bestCount));
    const pool = best.concat(remaining.slice(0, randomCount));
    const source = pool.length > 0 ? pool : sorted;
    const out = [];
    while (out.length < count) {
        out.push(choice(source));
    }
    return out;
}
function pickByRoulette(chromosomes, count) {
    if (chromosomes.length === 0 || count <= 0) {
        return [];
    }
    const fitnessValues = chromosomes.map((agent) => agent.get_fitness());
    const minFitness = Math.min(...fitnessValues);
    const shifted = fitnessValues.map((fitness) => Math.max(0, fitness - minFitness) + ROULETTE_EPSILON);
    const total = shifted.reduce((acc, value) => acc + value, 0);
    const out = [];
    for (let i = 0; i < count; i += 1) {
        const target = nextFloat() * total;
        let acc = 0;
        let picked = chromosomes[chromosomes.length - 1];
        for (let j = 0; j < chromosomes.length; j += 1) {
            acc += shifted[j];
            if (target <= acc) {
                picked = chromosomes[j];
                break;
            }
        }
        out.push(picked);
    }
    return out;
}
function pickByTournament(chromosomes, count) {
    if (chromosomes.length === 0 || count <= 0) {
        return [];
    }
    const out = [];
    const k = clampInt(activeConfig.tournamentK, 2, Math.max(2, chromosomes.length));
    for (let i = 0; i < count; i += 1) {
        let winner = choice(chromosomes);
        for (let j = 1; j < k; j += 1) {
            const contender = choice(chromosomes);
            if (contender.get_fitness() > winner.get_fitness()) {
                winner = contender;
            }
        }
        out.push(winner);
    }
    return out;
}
function pickByTruncation(chromosomes, count) {
    if (chromosomes.length === 0 || count <= 0) {
        return [];
    }
    const sorted = rankPopulationByFitness(chromosomes);
    const topCount = clampInt(Math.floor(chromosomes.length * activeConfig.truncationTopPct), 1, chromosomes.length);
    const topPool = sorted.slice(0, topCount);
    const out = [];
    while (out.length < count) {
        out.push(choice(topPool));
    }
    return out;
}
function selectParents(pop) {
    const count = Math.max(1, pop.length);
    if (activeConfig.selectionStrategy === "roulette") {
        return pickByRoulette(pop, count);
    }
    if (activeConfig.selectionStrategy === "tournament") {
        return pickByTournament(pop, count);
    }
    if (activeConfig.selectionStrategy === "truncation") {
        return pickByTruncation(pop, count);
    }
    return pickByRank(pop, count);
}
function createPopulation(popSize, loadedDna = null) {
    const pop = [];
    if (loadedDna) {
        if (loadedDna.length !== popSize) {
            throw new Error(`Invalid DNA payload. Expected ${popSize}, got ${loadedDna.length}.`);
        }
        for (let i = 0; i < popSize; i += 1) {
            pop.push(new Ball(loadedDna[i], false));
        }
        return pop;
    }
    for (let i = 0; i < popSize; i += 1) {
        pop.push(new Ball(null, false));
    }
    return pop;
}
function generation(currentPopulation) {
    const sorted = rankPopulationByFitness(currentPopulation);
    const eliteCount = clampInt(activeConfig.eliteCount, 0, currentPopulation.length - 1);
    const elites = sorted.slice(0, eliteCount).map((agent) => new Ball(agent.dna.genes.slice(), false));
    const parents = selectParents(currentPopulation);
    const childrenNeeded = currentPopulation.length - elites.length;
    const children = [];
    while (children.length < childrenNeeded) {
        const parentA = choice(parents);
        const parentB = choice(parents);
        const genes = crossover(parentA, parentB);
        children.push(new Ball(genes, true));
    }
    return elites.concat(children);
}
function algorithm(currentPopulation) {
    return generation(currentPopulation);
}






