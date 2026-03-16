# Darwin's Pond (p5.js)

## Project Overview
This folder contains a deterministic evolutionary simulation in p5.js. The current system is beyond the initial food-competition prototype and now includes:
- persistent renewable food patches
- epochal patch drift with partial relocation
- patch dormancy and seasonal productivity shifts
- energy-based survival dynamics
- evolvable speed/size traits
- experiment presets for balance testing
- richer diagnostics and benchmark workflow support

Architecture:
- source of truth: `sketch.ts`
- browser runtime: `dist/sketch.js`

Current implementation layers:
- P0: lifecycle stabilization, schema validation, boundary handling, cached environment sampling
- P1: deterministic RNG, telemetry export, configurable GA parent selection
- P2: persistent patch-based food geography with deterministic slot regrowth
- P3: energy economy + speed/size trait evolution
- P3 diagnostics: preset-driven balancing tools, richer telemetry, benchmark-suite workflow
- P4 ecology: epochal patch drift, random in-patch respawn, dormancy, and patch productivity heterogeneity

## How to Run
### Prerequisites
- modern browser
- Python
- Node.js + npm

### Run locally
1. Install local tooling:
```powershell
npm install
```
2. Build the runtime:
```powershell
npm run build
```
3. Serve the `p5js` folder:
```powershell
py -3 -m http.server 8000
```
4. Open:
`http://localhost:8000`

`index.html` loads `libraries/p5.min.js` and executes `dist/sketch.js`. The build script also mirrors the compiled runtime to `sketch.js`.

## Runtime Configuration (`SIM_CONFIG`)
Core GA/determinism:
- `seed`
- `maxGenerations`
- `populationSize`
- `mutationRate`
- `selectionStrategy` (`rank` | `roulette` | `tournament` | `truncation`)
- `eliteCount`
- `rankRetainBestPct`
- `rankRetainRandomPct`
- `tournamentK`
- `truncationTopPct`

Food and energy economy:
- `foodLayoutMode`
- `foodPatchCount`
- `foodPatchMinSeparation`
- `foodPatchMinRadius`, `foodPatchMaxRadius`
- `foodPatchMinUnits`, `foodPatchMaxUnits`
- `foodPatchRegenDelayFrames`
- `foodPatchRegenBatchSize`
- `foodConsumeRadius`
- `foodUnitEnergyReward`
- `foodEpochLengthGenerations`
- `foodPatchRelocationFractionPerEpoch`
- `foodPatchDriftRadius`
- `foodSlotRespawnMode`
- `foodPatchDormancyThreshold`
- `foodPatchDormancyDelayFrames`
- `foodPatchRecoveryBatchMultiplier`
- `foodPatchSeasonalAmplitude`
- `foodPatchSeasonalPeriodGenerations`
- `initialEnergy`
- `maxEnergy`
- `basalEnergyDrain`
- `speedEnergyCoeff`
- `sizeEnergyCoeff`
- `minSpeed`, `maxSpeed`
- `minSize`, `maxSize`
- `useBackgroundFitness`

Experiment presets:
- `baseline`
- `abundance`
- `scarcity`
- `metabolic_stress`

The active preset can be cycled in the UI, and benchmark runs reuse the selected preset across the fixed seed suite.

Interactive default:
- the browser sketch now starts at `populationSize: 200`
- creatures now start with a `life` budget of `300` frames instead of `100`

## What the Current Code Is Doing
### Deterministic core
- Internal RNG (`nextFloat`, `range`, `choice`, `shuffle`) drives all simulation-critical randomness.
- The same seed and config produce the same environment, population initialization, food events, mutation path, and selection path.

### Food competition
- Food is organized into persistent regional patches, but exact pellet coordinates are no longer frozen forever.
- Each patch contains many discrete consumable slots; one contact consumes one slot.
- Consumed slots respawn at new random positions inside the same patch after deterministic delay logic.
- Patches stay stable within an epoch, then a subset drifts or relocates at epoch boundaries.
- Heavily stripped patches can enter dormancy and recover more slowly, which makes overexploitation matter.
- Patch quality, capacity, and seasonal productivity are deterministic per seed, so regions differ in yield over time.
- Food restores energy, not direct fitness.

### Agent model and genome
- DNA length is **11 genes**:
- `genes[0..5]`: foraging/controller weights
- `genes[6..8]`: RGB color genes
- `genes[9]`: speed trait gene
- `genes[10]`: size trait gene
- Trait genes are continuous `[0, 1]` and mapped to runtime speed/size ranges from config.
- Each agent has:
- `life`
- `energy`
- `ageFrames`
- `starved`
- Death occurs when `life <= 0` or `energy <= 0`.
- Fitness is survival time: `ageFrames`.

### Diagnostics and HUD
- HUD shows:
- current generation and selection strategy
- active preset and benchmark progress
- food units and active patches
- mean alive energy
- starvation count
- mean speed/size
- energy range
- speed/size standard deviation
- mean alive frames
- simple phenotype buckets (fast/slow, large/small)
- Runtime UI can be hidden/shown with the `Hide UI` / `Show UI` toggle so the animation is easier to inspect.

### Evolution loop
- A generation ends when all agents die.
- Parent selection remains strategy-dispatched with elitism.
- Reproduction remains uniform crossover + mutation.

## Save/Load Contract (v7)
Required fields include:
- `version: 7`
- `seed`
- `config`
- `rng_state`
- lifecycle state (`gen_num`, `time`, `life`, `max_life`, `num_agents`, `max_len`, `max_len_last_episode`)
- `population_dna` (**11 genes per row**)
- `food_system` with:
- patch topology (`cx`, `cy`, `radius`, quality/capacity/regen multipliers, seasonal phase, slot count, epoch length)
- runtime state (epoch id, current slot positions, active flags, dormancy state, respawn accumulator, relocation flags)
- `telemetry`

Compatibility policy:
- strict schema policy; v6 and older save files are rejected.

## Telemetry Contract
Run-level:
- `seed`
- `preset_name`
- optional `benchmark_seed_suite`
- config snapshot
- timestamps
- `auto_exported`

Per-generation:
- fitness: `bestFitness`, `meanFitness`, `worstFitness`
- GA controls: `selectionStrategy`, `eliteCount`, `mutationRate`
- food metrics: `foodsConsumedTotal`, `foodsConsumedMeanPerAgent`, `respawnCount`, `activeFoodEndCount`
- patch metrics: `epochId`, `activePatchCountEnd`, `depletedPatchCount`, `patchDormantCount`, `patchRelocatedCount`, `patchMeanActiveFraction`, `patchTurnoverRate`, `meanNearestPatchDistance`, `patchConsumptionCounts`, `topPatchConsumptionShare`, `patchConsumptionEntropy`
- life/energy metrics: `meanLifeRemaining`, `meanEnergyRemaining`, `minEnergyRemaining`, `maxEnergyRemaining`
- death metrics: `starvationDeaths`, `timeoutDeaths`
- trait metrics: `meanSpeedTrait`, `meanSizeTrait`, `speedTraitStdDev`, `sizeTraitStdDev`
- survival metrics: `aliveFramesMean`
- phenotype buckets: `fastAgentCount`, `slowAgentCount`, `largeAgentCount`, `smallAgentCount`
- diversity metrics: `meanGeneStdDev`, `perGeneStdDev`

## Benchmark Workflow
CLI-first benchmark mode is now supported:
- `npm run bench -- --preset baseline` runs one preset headlessly.
- `npm run bench:all` runs the fixed seed suite across all presets in serial order.
- Named runner profiles are now supported:
- `smoke`: quick verification workload
- `balanced`: mid-scale benchmark workload
- `full_200x60`: population `200`, generations `60`
- `--population-size`, `--max-generations`, and `--timeout-ms` still exist and override profile defaults when passed explicitly.
- Each run writes one telemetry JSON per seed plus one aggregate suite JSON.
- Each session also writes `session.json` with the resolved workload, preset list, seed suite, and local hardware snapshot.
- Each preset directory also gets a generated `report.md`.
- Benchmark reports now include patch-usage columns so regional collapse/spread is visible without opening raw JSON.

Automation interface:
- query params: `?autorun=benchmark&preset=<preset-name>`
- optional export capture hook: `window.__DARWINS_POND_CAPTURE_EXPORT__(filename, payload)`

Outputs are written to `p5js/benchmarks/<timestamp>/<preset>/`.

Recommended heavy experiment:
```powershell
npm run bench:all -- --profile full_200x60
```

Quick validation before a long run:
```powershell
npm run bench:all -- --profile smoke
```

Use [BENCHMARK.md](/c:/Users/adminlcarreira/Darwins-Pond/p5js/BENCHMARK.md) for the exact command sequence and report-generation flow.

Use [benchmark-report.mjs](/c:/Users/adminlcarreira/Darwins-Pond/p5js/tools/benchmark-report.mjs) to print a Markdown comparison table from exported suite files.

## Completed Recently
### P0
- single-instance controls in `setup()`
- file-input-only loading
- schema validation and explicit errors
- cached field sampling instead of hot-path pixel reads

### P1
- deterministic RNG across simulation logic
- configurable selection strategies + elitism
- telemetry export and run-end auto export

### P2
- persistent patch geography
- slot-based local depletion and deterministic regrowth
- strict persistence for deterministic continuation

### P3
- energy economy as separate survival state
- speed/size trait genes
- survival-time fitness
- v5 save/load contract

### P3 Diagnostics
- named experiment presets for balancing
- richer telemetry diagnostics
- HUD-level convergence/collapse signals
- benchmark-suite workflow and report script

### P4 Ecology
- epochal patch drift instead of a frozen map forever
- random respawn inside patches instead of fixed pellet coordinates
- patch dormancy under overexploitation
- deterministic patch quality, capacity, and seasonal productivity
- v7 persistence for epoch/runtime patch state

## What Is Still Missing
### Technical debt
- restore strict TypeScript typing on the active implementation path
- add benchmark regression thresholds instead of report-only comparisons
- add experiment management across multiple benchmark sessions

### Feature gaps
- multiple food types beyond single-resource patch heterogeneity
- local reproduction or mate geography for true region-bound lineages
- interactive selection tooling
- broader ecosystem dynamics
- optional neural controllers

## What's Next
### Immediate next step
Run the full benchmark suite at `full_200x60` and tune the new patch ecology: epoch length, relocation fraction, dormancy delay, patch density, and seasonal amplitude. The next engineering work is balancing regional competition and regional turnover, not adding more food types yet.

### After that
1. Add richer ecological structure:
- multiple resource types or patch families
- seasonal or shifting patch productivity
- local spawn/reproduction rules if the goal becomes true regional lineages
2. Add stronger replay automation:
- regression thresholds on exported metrics
3. Only after the current regime is stable, move to:
- interactive selection
- ecosystem expansion
- combat/predation
- bitstring experiments

## Glossary
| Symbol | Role |
|---|---|
| `SIM_CONFIG` | Active runtime config after preset application. |
| `EXPERIMENT_PRESETS` | Named balance scenarios for abundance, scarcity, and metabolic stress. |
| `BENCHMARK_SEED_SUITE` | Fixed seed list used by built-in benchmark runs. |
| `window.__DARWINS_POND_CAPTURE_EXPORT__` | Optional browser hook used by the headless runner to capture JSON exports without downloads. |
| `session.json` | Session-level manifest containing workload profile, resolved workload, seed suite, and local hardware metadata. |
| `foodTopology` | Fixed patch anchors, radii, slot positions, and per-patch regrowth parameters for the whole run. |
| `foodSystem` | Runtime patch state: slot activity, respawn timers, and per-generation patch consumption counters. |
| `energy` | Agent resource pool consumed by metabolism and restored by food. |
| `genes[9]`, `genes[10]` | Speed and size trait genes. |
| `recordGenerationTelemetry` | Per-generation metric capture including new diagnostic aggregates. |
| `benchmark-runner.mjs` | Headless Playwright runner that builds, serves, executes presets, captures exports, and writes reports. |
| `benchmark-report.mjs` | CLI helper that converts suite exports into a Markdown comparison table. |

## Reference Material
`The-Nature-of-Code-Examples` is kept as a local reference directory related to the book examples. It is not part of the runtime, build, or benchmark workflow.
