#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function printUsage() {
  console.log("Usage: node tools/benchmark-report.mjs <benchmark-suite.json> [more-suite-files...]");
}

function loadSuite(filePath) {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
    throw new Error(`File is not a benchmark suite export: ${absolutePath}`);
  }
  return parsed.entries.map((entry) => ({
    preset_name: entry.preset_name,
    seed: entry.seed,
    bestFitness: entry.bestFitness,
    bestFitnessTailAvg: entry.bestFitnessTailAvg,
    meanEnergyRemaining: entry.meanEnergyRemaining,
    meanEnergyTailAvg: entry.meanEnergyTailAvg,
    starvationRatio: entry.starvationRatio,
    starvationRatioTailAvg: entry.starvationRatioTailAvg,
    meanSpeedTrait: entry.meanSpeedTrait,
    meanSizeTrait: entry.meanSizeTrait,
    foodsConsumedTotal: entry.foodsConsumedTotal,
    activePatchCountEnd: entry.activePatchCountEnd,
    depletedPatchCount: entry.depletedPatchCount,
    patchDormantCount: entry.patchDormantCount,
    patchRelocatedCount: entry.patchRelocatedCount,
    patchTurnoverRate: entry.patchTurnoverRate,
    patchTurnoverRateTailAvg: entry.patchTurnoverRateTailAvg,
    meanNearestPatchDistance: entry.meanNearestPatchDistance,
    topPatchConsumptionShare: entry.topPatchConsumptionShare,
    topPatchShareTailAvg: entry.topPatchShareTailAvg,
    patchConsumptionEntropy: entry.patchConsumptionEntropy,
    patchEntropyTailAvg: entry.patchEntropyTailAvg,
    directionChoiceEntropy: entry.directionChoiceEntropy,
    directionChoiceEntropyTailAvg: entry.directionChoiceEntropyTailAvg,
    telemetry_filename: entry.telemetry_filename || "",
  }));
}

function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help")) {
  printUsage();
  process.exit(args.length === 0 ? 1 : 0);
}

const rows = args.flatMap(loadSuite).sort((a, b) => {
  if (a.preset_name === b.preset_name) {
    return a.seed - b.seed;
  }
  return a.preset_name.localeCompare(b.preset_name);
});

console.log("| Preset | Seed | Best Fitness | Tail Fitness | Mean Energy | Tail Energy | Starvation Ratio | Tail Starvation | Mean Speed | Mean Size | Foods | Active Patches | Depleted Patches | Dormant Patches | Relocated Patches | Patch Turnover | Tail Turnover | Mean Patch Distance | Top Patch Share | Tail Top Share | Patch Entropy | Tail Entropy | Dir Entropy | Tail Dir Entropy | Telemetry |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|");
for (const row of rows) {
  console.log(
    `| ${row.preset_name} | ${row.seed} | ${formatNumber(row.bestFitness)} | ${formatNumber(row.bestFitnessTailAvg)} | ${formatNumber(row.meanEnergyRemaining)} | ${formatNumber(row.meanEnergyTailAvg)} | ${formatNumber(row.starvationRatio)} | ${formatNumber(row.starvationRatioTailAvg)} | ${formatNumber(row.meanSpeedTrait)} | ${formatNumber(row.meanSizeTrait)} | ${formatNumber(row.foodsConsumedTotal)} | ${formatNumber(row.activePatchCountEnd)} | ${formatNumber(row.depletedPatchCount)} | ${formatNumber(row.patchDormantCount)} | ${formatNumber(row.patchRelocatedCount)} | ${formatNumber(row.patchTurnoverRate)} | ${formatNumber(row.patchTurnoverRateTailAvg)} | ${formatNumber(row.meanNearestPatchDistance)} | ${formatNumber(row.topPatchConsumptionShare)} | ${formatNumber(row.topPatchShareTailAvg)} | ${formatNumber(row.patchConsumptionEntropy)} | ${formatNumber(row.patchEntropyTailAvg)} | ${formatNumber(row.directionChoiceEntropy)} | ${formatNumber(row.directionChoiceEntropyTailAvg)} | ${row.telemetry_filename} |`
  );
}
