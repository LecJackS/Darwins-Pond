# Benchmark Protocol

## Purpose
This project now supports repeatable headless benchmark runs for the energy-traits regime with persistent food patches, epochal drift, and patch dormancy.

Use the benchmark workflow to compare:
- `bestFitness`
- `meanEnergyRemaining`
- starvation vs timeout behavior
- mean speed/size traits
- patch usage concentration vs spread
- dormant or relocated patch pressure
- patch turnover across epochs

The fixed seed suite is defined in `sketch.ts` as `BENCHMARK_SEED_SUITE`.

## Primary Workflow
1. Install local tooling:
```powershell
npm install
```
2. Run a quick validation batch first:
```powershell
npm run bench:all -- --profile smoke
```
3. Run the main heavy experiment:
```powershell
npm run bench:all -- --profile full_200x60
```
4. Inspect outputs in:
`p5js/benchmarks/<timestamp>/<preset>/`
5. The session root contains:
- `session.json` with resolved workload, hardware snapshot, presets, and seed suite
6. Each preset folder contains:
- one telemetry export per seed: `telemetry_run_<seed>_auto_<timestamp>.json`
- one suite summary export: `benchmark_suite_<preset>_<timestamp>.json`
- one generated Markdown comparison report: `report.md`

## Useful Variants
Run a single preset:
```powershell
npm run bench -- --preset scarcity --profile balanced
```

Run the heavy workload on one preset only:
```powershell
npm run bench -- --preset scarcity --profile full_200x60
```

Override a profile explicitly:
```powershell
npm run bench -- --preset baseline --profile full_200x60 --max-generations 40
```

Write outputs somewhere else:
```powershell
npm run bench -- --preset baseline --out-dir .\bench-output
```

Regenerate a Markdown comparison table from one or more suite files:
```powershell
npm run report -- .\benchmarks\<timestamp>\<preset>\benchmark_suite_<preset>_<timestamp>.json
```

## Expected Output Columns
The report script prints:
- preset
- seed
- best fitness
- mean energy remaining
- starvation ratio
- mean speed trait
- mean size trait
- foods consumed total
- active patches at generation end
- depleted patches
- dormant patches
- relocated patches
- patch turnover rate
- mean nearest patch distance
- top patch consumption share
- patch consumption entropy
- telemetry filename

## Notes
- The headless runner builds the sketch, serves the `p5js` directory, opens the sketch with `?autorun=benchmark&preset=...`, and captures JSON exports through `window.__DARWINS_POND_CAPTURE_EXPORT__`.
- The runner workload is resolved from `--profile` plus any explicit overrides. Explicit flags always win.
- Longer life budgets increase generation duration, so the built-in profile timeouts are set higher than before.
- Benchmark mode restarts the simulation for each seed in the suite.
- Benchmark runs preserve deterministic behavior because the same preset config is rebuilt per seed.
- Use the same preset, seed suite, and workload profile when comparing code changes across branches.
- The food map is now stable within each epoch, not forever: patches drift only at epoch boundaries, and only a subset relocates at each epoch.
- Food slots respawn at new random positions inside their patch instead of snapping back to one permanent coordinate.
- `The-Nature-of-Code-Examples` is a local reference directory only; it is not used by the runner or runtime.

## How to Interpret Results
- starvation-heavy collapse: energy economy is too punishing or food is too scarce
- timeout-heavy under-selection: the environment is too forgiving to differentiate traits
- speed/size convergence: traits may be finding one dominant attractor
- mixed trait regimes: usually the most useful sign that scarcity is creating real tradeoffs
- high top-patch share + low entropy: the population is collapsing onto one patch or one dominant region
- lower top-patch share + higher entropy: patch usage is spread across regions, which is better for emergent territorial competition
- high dormant-patch count: exploitation pressure is locally exhausting patches
- non-zero relocated-patch count with stable performance: the population is coping with macro-geography drift instead of overfitting to one frozen map
- higher patch turnover with reasonable entropy: agents are using renewable regions instead of camping one exact pellet layout
