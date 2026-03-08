# Darwin's Pond (p5.js)

## Project Overview
This folder contains a p5.js evolutionary simulation with a genetic algorithm. The current runtime is now **P2**: agents compete over shared, discrete food objects with deterministic spawning/respawning.

Architecture:
- Source of truth: `sketch.ts`
- Browser runtime: `dist/sketch.js`

Current implemented layers:
- P0: lifecycle, schema validation, boundary handling, cached environment sampling
- P1: deterministic RNG, telemetry, configurable GA selection
- P2: discrete shared food competition with v4 persistence

## How to Run
### Prerequisites
- Modern browser
- Python
- Node.js + TypeScript (`tsc`) if you want to build from TS

### Run locally
1. (Optional build) compile TypeScript:
```powershell
tsc -p tsconfig.json
```
2. Serve `p5js`:
```powershell
py -3 -m http.server 8000
```
3. Open:
`http://localhost:8000`

`index.html` loads `libraries/p5.min.js` and runs `dist/sketch.js`.

## Runtime Configuration (`SIM_CONFIG`)
Core:
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

Food system (P2):
- `foodCount`
- `foodRespawnCooldownFrames`
- `foodConsumeRadius`
- `foodFitnessReward`
- `foodLifeReward`
- `useBackgroundFitness` (default `false`, food-first objective)

## What the Current Code Is Doing
### Deterministic core
- Uses internal deterministic RNG (`nextFloat`, `range`, `choice`, `shuffle`).
- Food spawn, respawn, mutation, crossover, and selection all use this RNG.

### Environment and food layer
- Environment still renders from cached field (`buildEnvironmentField`, `sampleGreen`, `sampleSensor4`).
- Primary objective is no longer green intensity.
- Shared discrete food pool is managed by:
  - `createFoodSystem`
  - `updateFoodRespawns`
  - `renderActiveFoods`
  - `tryConsumeFood`

### Agent behavior and competition
- DNA has 9 genes:
  - motion/foraging genes: `0..5`
  - color genes: `6..8`
- Motion genes now steer toward food using nearest-food vector, local food density, boundary risk, and inertia bias.
- Competition is shared: first agent reaching a food consumes it; consumed items become inactive and respawn after fixed cooldown.
- Consume rewards:
  - `fitness += foodFitnessReward`
  - `life += foodLifeReward` (capped at `MAX_LIFE`)
- Boundary clamp + penalties remain active.

### Evolution loop
- Generation ends when all agents are dead.
- Selection uses strategy dispatch + shared elitism.
- Reproduction stays crossover + mutation.

### Persistence and telemetry
- Save/load is file-input-only with strict schema validation.
- Save schema is now **v4** and intentionally rejects older versions.
- Telemetry export is available via button and run-end auto export.

## Save/Load Interface Contract (v4)
Required fields:
- `version: 4`
- `seed`
- `config`
- `rng_state`
- lifecycle state (`gen_num`, `time`, `life`, `max_life`, `num_agents`, `max_len`, `max_len_last_episode`)
- `population_dna`
- `food_system`
- `telemetry`

`food_system` contract:
- `foods[]` with `{ id, x, y, active, respawn_at_frame }`
- `consumed_this_generation`
- `respawned_this_generation`

Compatibility policy:
- v3 and older saves are rejected by design.

## Telemetry Contract
Run-level:
- seed
- config snapshot
- timestamps
- auto-export marker

Per-generation:
- `gen`
- `bestFitness`, `meanFitness`, `worstFitness`
- `selectionStrategy`, `eliteCount`, `mutationRate`
- food metrics:
  - `foodsConsumedTotal`
  - `foodsConsumedMeanPerAgent`
  - `respawnCount`
  - `activeFoodEndCount`
  - `meanLifeRemaining`
- diversity metrics:
  - `meanGeneStdDev`
  - `perGeneStdDev`

## Completed Recently
### P0
- Single-instance UI control lifecycle in `setup()`
- File-input-only loading
- Schema validation + explicit errors
- Boundary clamp + penalties
- Cached field sampling (removed hot-path `get()` access)

### P1
- Deterministic RNG integrated through simulation logic
- Configurable GA selection engine
- Telemetry capture/export
- Deterministic seed/config control surface

### P2
- Discrete shared food objects with active/inactive state
- Deterministic food spawn + respawn behavior
- Food-seeking controller replacing green-proxy steering
- Competition rule implemented (first-touch consume)
- Life + fitness reward economy on consume
- Extended telemetry with food/economy stats
- Save schema upgraded to v4 with persisted food state + RNG state

## What Is Still Missing
### Technical debt
- Restore strict TypeScript typing on the active `sketch.ts` path (current code prioritizes runtime parity and P2 delivery).
- Add repeatable automated smoke/perf checks for strategy and food-economy regressions.
- Add batch experiment runner + aggregate comparison outputs.

### Feature gaps (roadmap)
- P3 interactive selection tooling.
- P4 ecosystem expansion (resource pressure, species roles, competition policies).
- P5 optional neural controllers.

## What's Next
### Immediate next (recommended)
1. Add food scarcity controls (seasonality, cluster patterns, depletion pressure).
2. Add telemetry-derived diagnostics (consumption distribution per agent and per-food occupancy heatmaps).
3. Add deterministic replay test fixtures from saved v4 states.

### After immediate
- P3: human-guided selection UX
- P4: full ecosystem mechanics (multi-role entities, predation/avoidance, energy budgets)
- P5: neural/learned policy experiments

## Glossary
| Symbol | Role |
|---|---|
| `SIM_CONFIG` | Single runtime config surface (GA + food + determinism controls). |
| `nextFloat` / `range` / `choice` / `shuffle` | Deterministic RNG API for simulation events. |
| `foodSystem` | Shared food state (items, active/inactive flags, respawn scheduling, counters). |
| `findNearestActiveFood` / `tryConsumeFood` | Core foraging and competition primitives. |
| `saveEnv` / `validateSavedEnvironment` / `applySavedEnvironment` | v4 persistence and strict load path. |
| `recordGenerationTelemetry` / `exportTelemetry` | Per-generation metrics capture and export. |
| `selectParents` | GA selection strategy dispatch + elitism integration. |

