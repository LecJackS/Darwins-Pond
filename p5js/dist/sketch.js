// @ts-nocheck
"use strict";
const SAVE_SCHEMA_VERSION = 5;
const TELEMETRY_SCHEMA_VERSION = 1;
const DNA_GENE_COUNT = 11;
const DNA_MOTION_GENE_LAST_INDEX = 5;
const DNA_COLOR_GENE_FIRST_INDEX = 6;
const DNA_COLOR_GENE_LAST_INDEX = 8;
const DNA_SPEED_GENE_INDEX = 9;
const DNA_SIZE_GENE_INDEX = 10;
const SENSOR_OFFSET = 2;
const BOUNDARY_LIFE_PENALTY = 1;
const BOUNDARY_ENERGY_PENALTY = 2;
const RANDOM_SPOT_COUNT = 100;
const RANDOM_SPOT_RADIUS = 2;
const ROULETTE_EPSILON = 1e-6;
const FOOD_DEFAULT_RESPAWN_FRAME = -1;
const FOOD_RENDER_RADIUS = 4;
const FOOD_STEER_RADIUS = 160;
const DIRECTIONS = {
    1: { dx: 1, dy: 0 },
    2: { dx: 0, dy: 1 },
    3: { dx: -1, dy: 0 },
    4: { dx: 0, dy: -1 },
};
const SIM_CONFIG = {
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
    foodCount: 160,
    foodRespawnCooldownFrames: 60,
    foodConsumeRadius: 6,
    foodEnergyReward: 40,
    initialEnergy: 340,
    maxEnergy: 1000,
    basalEnergyDrain: 1,
    speedEnergyCoeff: 0.8,
    sizeEnergyCoeff: 0.4,
    minSpeed: 0.5,
    maxSpeed: 3,
    minSize: 2,
    maxSize: 8,
    useBackgroundFitness: false,
};
let activeConfig = { ...SIM_CONFIG };
let activeSeed = SIM_CONFIG.seed;
let rngState = 1;
let population = [];
let alive = [];
let gen_num = 0;
let LIFE = 100;
let MAX_LIFE = 300;
let NUM_AGENTS = SIM_CONFIG.populationSize;
let TIME = 0;
let MAX_LEN = 0;
let MAX_LEN_LAST_EPISODE = 0;
let W = 0;
let H = 0;
let saveButton = null;
let loadInput = null;
let exportTelemetryButton = null;
let statusMessage = "";
let environmentField = null;
let foodSystem = null;
let runTelemetry = createRunTelemetry(activeSeed, activeConfig);
let runFinished = false;
let starvationDeathsThisGeneration = 0;
let timeoutDeathsThisGeneration = 0;
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
        foodCount: config.foodCount,
        foodRespawnCooldownFrames: config.foodRespawnCooldownFrames,
        foodConsumeRadius: config.foodConsumeRadius,
        foodEnergyReward: config.foodEnergyReward,
        initialEnergy: config.initialEnergy,
        maxEnergy: config.maxEnergy,
        basalEnergyDrain: config.basalEnergyDrain,
        speedEnergyCoeff: config.speedEnergyCoeff,
        sizeEnergyCoeff: config.sizeEnergyCoeff,
        minSpeed: config.minSpeed,
        maxSpeed: config.maxSpeed,
        minSize: config.minSize,
        maxSize: config.maxSize,
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
    config.foodCount = Math.max(1, Math.floor(config.foodCount));
    config.foodRespawnCooldownFrames = Math.max(1, Math.floor(config.foodRespawnCooldownFrames));
    config.foodConsumeRadius = clampNumber(config.foodConsumeRadius, 1, 64);
    config.foodEnergyReward = clampNumber(config.foodEnergyReward, 0, 10000);
    config.initialEnergy = clampNumber(config.initialEnergy, 1, 10000);
    config.maxEnergy = clampNumber(config.maxEnergy, 1, 10000);
    config.basalEnergyDrain = clampNumber(config.basalEnergyDrain, 0, 1000);
    config.speedEnergyCoeff = clampNumber(config.speedEnergyCoeff, 0, 1000);
    config.sizeEnergyCoeff = clampNumber(config.sizeEnergyCoeff, 0, 1000);
    config.minSpeed = clampNumber(config.minSpeed, 0.1, 100);
    config.maxSpeed = clampNumber(config.maxSpeed, config.minSpeed, 100);
    config.minSize = clampNumber(config.minSize, 0.5, 200);
    config.maxSize = clampNumber(config.maxSize, config.minSize, 200);
    config.initialEnergy = clampNumber(config.initialEnergy, 1, config.maxEnergy);
    config.useBackgroundFitness = Boolean(config.useBackgroundFitness);
    return config;
}
function nowIso() {
    return new Date().toISOString();
}
function telemetryTimestamp() {
    return nowIso().replace(/[:.]/g, "-");
}
function createRunTelemetry(seed, config) {
    return {
        schema_version: TELEMETRY_SCHEMA_VERSION,
        seed,
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
function sampleSensor4(x, y, offset = SENSOR_OFFSET) {
    return {
        a: sampleGreen(x + offset, y + offset),
        b: sampleGreen(x + offset, y - offset),
        c: sampleGreen(x - offset, y + offset),
        d: sampleGreen(x - offset, y - offset),
    };
}
function randomFoodPosition() {
    return {
        x: range(1, Math.max(2, W - 2)),
        y: range(1, Math.max(2, H - 2)),
    };
}
function createFoodSystem(foodCount = activeConfig.foodCount) {
    const foods = [];
    for (let i = 0; i < foodCount; i += 1) {
        const pos = randomFoodPosition();
        foods.push({
            id: i,
            x: pos.x,
            y: pos.y,
            active: true,
            respawnAtFrame: FOOD_DEFAULT_RESPAWN_FRAME,
        });
    }
    return {
        foods,
        consumedThisGeneration: 0,
        respawnedThisGeneration: 0,
    };
}
function createFoodFallbackSnapshot(foodCount = activeConfig.foodCount) {
    const foods = [];
    for (let i = 0; i < foodCount; i += 1) {
        foods.push({
            id: i,
            x: W / 2,
            y: H / 2,
            active: true,
            respawnAtFrame: FOOD_DEFAULT_RESPAWN_FRAME,
        });
    }
    return {
        foods,
        consumedThisGeneration: 0,
        respawnedThisGeneration: 0,
    };
}
function cloneFoodSystem(source) {
    return {
        foods: source.foods.map((food) => ({
            id: food.id,
            x: food.x,
            y: food.y,
            active: food.active,
            respawnAtFrame: food.respawnAtFrame,
        })),
        consumedThisGeneration: source.consumedThisGeneration,
        respawnedThisGeneration: source.respawnedThisGeneration,
    };
}
function serializeFoodSystem(source) {
    const snapshot = cloneFoodSystem(source);
    return {
        foods: snapshot.foods.map((food) => ({
            id: food.id,
            x: food.x,
            y: food.y,
            active: food.active,
            respawn_at_frame: food.respawnAtFrame,
        })),
        consumed_this_generation: snapshot.consumedThisGeneration,
        respawned_this_generation: snapshot.respawnedThisGeneration,
    };
}
function resetFoodSystem() {
    foodSystem = createFoodSystem(activeConfig.foodCount);
}
function countActiveFoods() {
    if (!foodSystem) {
        return 0;
    }
    let activeCount = 0;
    for (let i = 0; i < foodSystem.foods.length; i += 1) {
        if (foodSystem.foods[i].active) {
            activeCount += 1;
        }
    }
    return activeCount;
}
function updateFoodRespawns(currentFrame) {
    if (!foodSystem) {
        return;
    }
    for (let i = 0; i < foodSystem.foods.length; i += 1) {
        const food = foodSystem.foods[i];
        if (food.active) {
            continue;
        }
        if (food.respawnAtFrame > currentFrame) {
            continue;
        }
        const pos = randomFoodPosition();
        food.x = pos.x;
        food.y = pos.y;
        food.active = true;
        food.respawnAtFrame = FOOD_DEFAULT_RESPAWN_FRAME;
        foodSystem.respawnedThisGeneration += 1;
    }
}
function renderActiveFoods() {
    if (!foodSystem) {
        return;
    }
    noStroke();
    fill(255, 220, 64, 220);
    for (let i = 0; i < foodSystem.foods.length; i += 1) {
        const food = foodSystem.foods[i];
        if (!food.active) {
            continue;
        }
        circle(food.x, food.y, FOOD_RENDER_RADIUS * 2);
    }
}
function findNearestActiveFood(x, y) {
    if (!foodSystem) {
        return null;
    }
    let nearest = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (let i = 0; i < foodSystem.foods.length; i += 1) {
        const food = foodSystem.foods[i];
        if (!food.active) {
            continue;
        }
        const dx = food.x - x;
        const dy = food.y - y;
        const distSq = dx * dx + dy * dy;
        if (distSq >= bestDistSq) {
            continue;
        }
        bestDistSq = distSq;
        nearest = food;
    }
    if (!nearest) {
        return null;
    }
    return {
        food: nearest,
        distSq: bestDistSq,
    };
}
function sampleFoodDensity(x, y, radius = FOOD_STEER_RADIUS) {
    if (!foodSystem || radius <= 0) {
        return 0;
    }
    let count = 0;
    const radiusSq = radius * radius;
    for (let i = 0; i < foodSystem.foods.length; i += 1) {
        const food = foodSystem.foods[i];
        if (!food.active) {
            continue;
        }
        const dx = food.x - x;
        const dy = food.y - y;
        if (dx * dx + dy * dy <= radiusSq) {
            count += 1;
        }
    }
    return count / Math.max(1, foodSystem.foods.length);
}
function tryConsumeFood(agent, currentFrame) {
    if (!foodSystem) {
        return false;
    }
    const consumeRadius = activeConfig.foodConsumeRadius + agent.size * 0.5;
    const consumeRadiusSq = consumeRadius * consumeRadius;
    for (let i = 0; i < foodSystem.foods.length; i += 1) {
        const food = foodSystem.foods[i];
        if (!food.active) {
            continue;
        }
        const dx = agent.x - food.x;
        const dy = agent.y - food.y;
        if (dx * dx + dy * dy > consumeRadiusSq) {
            continue;
        }
        food.active = false;
        food.respawnAtFrame = currentFrame + activeConfig.foodRespawnCooldownFrames;
        foodSystem.consumedThisGeneration += 1;
        agent.energy = Math.min(activeConfig.maxEnergy, agent.energy + activeConfig.foodEnergyReward);
        return true;
    }
    return false;
}
function exportTelemetry(autoExport = false) {
    if (runTelemetry.generations.length === 0) {
        statusMessage = "Telemetry export skipped: no generations recorded yet.";
        return;
    }
    const tag = autoExport ? "auto" : "manual";
    const filename = `telemetry_run_${activeSeed}_${tag}_${telemetryTimestamp()}.json`;
    saveJSON(runTelemetry, filename);
    if (autoExport) {
        runTelemetry.auto_exported = true;
        runTelemetry.completed_at = nowIso();
    }
    statusMessage = autoExport
        ? `Run finished. Telemetry auto-exported to ${filename}`
        : `Telemetry exported to ${filename}`;
}
function createControls() {
    if (!saveButton) {
        saveButton = createButton("Save");
        saveButton.position(0, 0);
        saveButton.mousePressed(saveEnv);
    }
    if (!loadInput) {
        loadInput = createFileInput(onLoadFile, false);
        loadInput.position(0, 20);
    }
    if (!exportTelemetryButton) {
        exportTelemetryButton = createButton("Export Telemetry");
        exportTelemetryButton.position(0, 40);
        exportTelemetryButton.mousePressed(() => {
            exportTelemetry(false);
        });
    }
}
function showStatus() {
    if (!statusMessage) {
        return;
    }
    noStroke();
    fill(255, 64, 64);
    text(statusMessage, 10, 306);
}
function drawHud() {
    const aliveAgents = population.filter((agent, idx) => alive[idx]);
    const meanAliveEnergy = aliveAgents.length > 0
        ? aliveAgents.reduce((acc, agent) => acc + Math.max(0, agent.energy), 0) / aliveAgents.length
        : 0;
    const meanSpeedTrait = population.length > 0
        ? population.reduce((acc, agent) => acc + agent.speed, 0) / population.length
        : 0;
    const meanSizeTrait = population.length > 0
        ? population.reduce((acc, agent) => acc + agent.size, 0) / population.length
        : 0;
    noStroke();
    fill(255);
    textSize(16);
    text(`Gen: ${gen_num}/${activeConfig.maxGenerations}`, 10, 80);
    text(`Max Len: ${MAX_LEN}`, 10, 102);
    text(`Last Pool: ${MAX_LEN_LAST_EPISODE}`, 10, 124);
    text(`Seed: ${activeSeed}`, 10, 146);
    text(`Strategy: ${activeConfig.selectionStrategy}`, 10, 168);
    text(`Food Active: ${countActiveFoods()}/${activeConfig.foodCount}`, 10, 190);
    text(`Food Eaten: ${foodSystem ? foodSystem.consumedThisGeneration : 0}`, 10, 212);
    text(`Mean Energy (alive): ${round2(meanAliveEnergy)}`, 10, 234);
    text(`Starvations: ${starvationDeathsThisGeneration}`, 10, 256);
    text(`Mean Speed/Size: ${round2(meanSpeedTrait)} / ${round2(meanSizeTrait)}`, 10, 278);
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
    initializeRun(SIM_CONFIG.seed, SIM_CONFIG);
    refreshEnvironment();
    resetFoodSystem();
    population = createPopulation(NUM_AGENTS);
    alive = arrayOfN(NUM_AGENTS, true);
    gen_num = 1;
    TIME = 0;
    createControls();
}
function draw() {
    if (runFinished) {
        return;
    }
    TIME += 1;
    paintEnvironment();
    updateFoodRespawns(TIME);
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
        agent.move(TIME);
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
    const activeFoodEndCount = countActiveFoods();
    const meanEnergyRemaining = pop.reduce((acc, agent) => acc + Math.max(0, agent.energy), 0) / Math.max(1, pop.length);
    const meanSpeedTrait = pop.reduce((acc, agent) => acc + agent.speed, 0) / Math.max(1, pop.length);
    const meanSizeTrait = pop.reduce((acc, agent) => acc + agent.size, 0) / Math.max(1, pop.length);
    const diversity = computeDiversity(pop);
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
        meanEnergyRemaining: round2(meanEnergyRemaining),
        starvationDeaths: starvationDeathsThisGeneration,
        timeoutDeaths: timeoutDeathsThisGeneration,
        meanSpeedTrait: round2(meanSpeedTrait),
        meanSizeTrait: round2(meanSizeTrait),
        meanGeneStdDev: diversity.meanGeneStdDev,
        perGeneStdDev: diversity.perGeneStdDev,
    });
}
function finalizeGeneration() {
    updateBestStats();
    recordGenerationTelemetry(population);
    if (gen_num >= activeConfig.maxGenerations) {
        exportTelemetry(true);
        runFinished = true;
        noLoop();
        return;
    }
    population = algorithm(population);
    alive = arrayOfN(NUM_AGENTS, true);
    TIME = 0;
    gen_num += 1;
    starvationDeathsThisGeneration = 0;
    timeoutDeathsThisGeneration = 0;
    clear();
    refreshEnvironment();
    resetFoodSystem();
}
function saveEnv() {
    const payload = {
        version: SAVE_SCHEMA_VERSION,
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
        food_system: serializeFoodSystem(foodSystem ? foodSystem : createFoodFallbackSnapshot(activeConfig.foodCount)),
        telemetry: runTelemetry,
    };
    saveJSON(payload, `saved_environment_v5_gen${gen_num}.json`);
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
        "foodCount",
        "foodRespawnCooldownFrames",
        "foodConsumeRadius",
        "foodEnergyReward",
        "initialEnergy",
        "maxEnergy",
        "basalEnergyDrain",
        "speedEnergyCoeff",
        "sizeEnergyCoeff",
        "minSpeed",
        "maxSpeed",
        "minSize",
        "maxSize",
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
        foodCount: record.foodCount,
        foodRespawnCooldownFrames: record.foodRespawnCooldownFrames,
        foodConsumeRadius: record.foodConsumeRadius,
        foodEnergyReward: record.foodEnergyReward,
        initialEnergy: record.initialEnergy,
        maxEnergy: record.maxEnergy,
        basalEnergyDrain: record.basalEnergyDrain,
        speedEnergyCoeff: record.speedEnergyCoeff,
        sizeEnergyCoeff: record.sizeEnergyCoeff,
        minSpeed: record.minSpeed,
        maxSpeed: record.maxSpeed,
        minSize: record.minSize,
        maxSize: record.maxSize,
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
            "meanLifeRemaining",
            "meanEnergyRemaining",
            "starvationDeaths",
            "timeoutDeaths",
            "meanSpeedTrait",
            "meanSizeTrait",
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
            meanLifeRemaining: genRecord.meanLifeRemaining,
            meanEnergyRemaining: genRecord.meanEnergyRemaining,
            starvationDeaths: genRecord.starvationDeaths,
            timeoutDeaths: genRecord.timeoutDeaths,
            meanSpeedTrait: genRecord.meanSpeedTrait,
            meanSizeTrait: genRecord.meanSizeTrait,
            meanGeneStdDev: genRecord.meanGeneStdDev,
            perGeneStdDev,
        };
    });
    return {
        schema_version: record.schema_version,
        seed: record.seed,
        config,
        started_at: record.started_at,
        completed_at: record.completed_at,
        auto_exported: record.auto_exported,
        generations,
    };
}
function parseFoodSystem(raw, expectedFoodCount) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error("Invalid or missing food_system object.");
    }
    const record = raw;
    if (!isFiniteNumber(record.consumed_this_generation)) {
        throw new Error("Invalid food_system field: consumed_this_generation");
    }
    if (!isFiniteNumber(record.respawned_this_generation)) {
        throw new Error("Invalid food_system field: respawned_this_generation");
    }
    if (!Array.isArray(record.foods)) {
        throw new Error("Invalid food_system field: foods");
    }
    if (record.foods.length !== expectedFoodCount) {
        throw new Error(`food_system foods length (${record.foods.length}) != config.foodCount (${expectedFoodCount}).`);
    }
    const foods = record.foods.map((entry, index) => {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
            throw new Error(`Invalid food entry at index ${index}`);
        }
        const foodRecord = entry;
        if (!isFiniteNumber(foodRecord.id) ||
            !isFiniteNumber(foodRecord.x) ||
            !isFiniteNumber(foodRecord.y) ||
            typeof foodRecord.active !== "boolean" ||
            !isFiniteNumber(foodRecord.respawn_at_frame)) {
            throw new Error(`Invalid food fields at index ${index}`);
        }
        return {
            id: Math.floor(foodRecord.id),
            x: foodRecord.x,
            y: foodRecord.y,
            active: foodRecord.active,
            respawnAtFrame: Math.floor(foodRecord.respawn_at_frame),
        };
    });
    return {
        foods,
        consumedThisGeneration: Math.max(0, Math.floor(record.consumed_this_generation)),
        respawnedThisGeneration: Math.max(0, Math.floor(record.respawned_this_generation)),
    };
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
    const config = parseConfig(record.config);
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
    const foodSystemState = parseFoodSystem(record.food_system, config.foodCount);
    const telemetry = parseRunTelemetry(record.telemetry);
    return {
        version: SAVE_SCHEMA_VERSION,
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
    TIME = payload.time;
    foodSystem = cloneFoodSystem(payload.food_system);
    runTelemetry = payload.telemetry;
    runFinished = false;
    starvationDeathsThisGeneration = 0;
    timeoutDeathsThisGeneration = 0;
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
                if (i <= DNA_MOTION_GENE_LAST_INDEX) {
                    this.genes.push(DNA.randomMotionGene());
                }
                else if (i <= DNA_COLOR_GENE_LAST_INDEX) {
                    this.genes.push(DNA.randomColorGene());
                }
                else {
                    this.genes.push(DNA.randomTraitGene());
                }
            }
        }
        this.fitness = 0;
    }
    static randomMotionGene() {
        return range(-1, 1);
    }
    static randomColorGene() {
        return range(0, 255);
    }
    static randomTraitGene() {
        return range(0, 1);
    }
    mutate() {
        for (let i = 0; i < this.genes.length; i += 1) {
            if (nextFloat() >= activeConfig.mutationRate) {
                continue;
            }
            if (i <= DNA_MOTION_GENE_LAST_INDEX) {
                this.genes[i] = DNA.randomMotionGene();
            }
            else if (i <= DNA_COLOR_GENE_LAST_INDEX) {
                this.genes[i] = DNA.randomColorGene();
            }
            else {
                this.genes[i] = DNA.randomTraitGene();
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
        this.r = this.dna.genes[DNA_COLOR_GENE_FIRST_INDEX];
        this.g = this.dna.genes[DNA_COLOR_GENE_FIRST_INDEX + 1];
        this.b = this.dna.genes[DNA_COLOR_GENE_FIRST_INDEX + 2];
        this.speed = mapUnitGene(this.dna.genes[DNA_SPEED_GENE_INDEX], activeConfig.minSpeed, activeConfig.maxSpeed);
        this.size = mapUnitGene(this.dna.genes[DNA_SIZE_GENE_INDEX], activeConfig.minSize, activeConfig.maxSize);
        this.move_dir = this.getDir();
    }
    getDir() {
        const nearest = findNearestActiveFood(this.x, this.y);
        const maxDistance = Math.max(1, Math.sqrt(W * W + H * H));
        let foodDx = 0;
        let foodDy = 0;
        let foodDistanceNorm = 0;
        if (nearest) {
            const distance = Math.sqrt(nearest.distSq);
            foodDistanceNorm = 1 - clampNumber(distance / maxDistance, 0, 1);
            if (distance > 0) {
                foodDx = (nearest.food.x - this.x) / distance;
                foodDy = (nearest.food.y - this.y) / distance;
            }
        }
        let bestDir = 1;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (let dir = 1; dir <= 4; dir += 1) {
            const direction = DIRECTIONS[dir];
            const nextX = this.x + direction.dx;
            const nextY = this.y + direction.dy;
            const alignment = direction.dx * foodDx + direction.dy * foodDy;
            const localFoodDensity = sampleFoodDensity(nextX, nextY);
            const nearBoundary = nextX <= 1 || nextX >= width - 2 || nextY <= 1 || nextY >= height - 2 ? 1 : 0;
            const inertia = dir === this.move_dir ? 1 : 0;
            const score = this.dna.genes[0] * alignment +
                this.dna.genes[1] * foodDistanceNorm +
                this.dna.genes[2] * localFoodDensity -
                Math.abs(this.dna.genes[3]) * nearBoundary +
                this.dna.genes[4] * inertia +
                this.dna.genes[5];
            if (score > bestScore) {
                bestScore = score;
                bestDir = dir;
            }
        }
        return bestDir;
    }
    move(currentFrame) {
        this.move_dir = clampInt(this.getDir(), 1, 4);
        const direction = DIRECTIONS[this.move_dir];
        this.x += direction.dx * this.speed;
        this.y += direction.dy * this.speed;
        this.life -= 1;
        this.ageFrames += 1;
        const energyDrain = activeConfig.basalEnergyDrain +
            activeConfig.speedEnergyCoeff * this.speed * this.speed +
            activeConfig.sizeEnergyCoeff * this.size;
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
function crossover(parentA, parentB) {
    const childGenes = [];
    for (let i = 0; i < DNA_GENE_COUNT; i += 1) {
        if (nextFloat() < 0.5) {
            childGenes.push(parentA.dna.genes[i]);
        }
        else {
            childGenes.push(parentB.dna.genes[i]);
        }
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
