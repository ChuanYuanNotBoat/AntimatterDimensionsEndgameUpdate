# ADE multiplier-analysis audit (2026-09-16)

Scope: the uploaded `src/` tree, with the two separately supplied 2026-09-16 late-game saves used for structural inspection. Analysis and UI only; no gameplay-formula or saved-tab-ID changes.

## Sequential formulas and differential verification

| Analysis | Gameplay comparison | Meaning |
| --- | --- | --- |
| AD1–AD8 | `getDimensionFinalMultiplierUncached(tier)` | Per-tier multiplier, not actual production; ordered powers, dilation, softcaps, late-game effects and per-source counterfactual replay. Overall is the product of producing tiers' multipliers. |
| Replicanti | `totalReplicantiSpeedMult` | External speed multiplier; not actual Replicanti/sec or interval behavior above cap. |
| Dilated Time | `getDilationGainPerSecond` | DT gain/sec from CURRENT TP stock; sequential effects, Pelle, Null, Enslaved, V, game speed, softcap. |
| Infinities | `gainedInfinities` | Gain per Crunch, including challenge fixed gains and later sources. |
| Eternities | `gainedEternities` | Gain per Eternity, including achievement 102 and late sources. |

These modules provide ordered, labeled transforms and an explicit mismatch row when reconstructed output disagrees with the actual gameplay formula. The direct/final impact calculation removes a source and replays subsequent steps instead of multiplying all listed entries; AD child-source replay is lazy to reduce UI CPU use. AD total and individual-tier roots show multiplier values, not a fictional AM production proxy. AD achievement sources no longer double-count Time Studies/IC8.

The tests `node --test tests/*.test.cjs` run actual gameplay formula bodies extracted from this uploaded source tree against the reconstructed calculations under MOCKED finite-number states: 18 AD scenarios × eight tiers, plus assorted challenge, Pelle, Null, Enslaved, V, overcap, ascension and other scenarios for remaining resources. `node --check` separately verifies JS syntax. **These are mocked branch tests, not live save-backed validation, nor tests of the game's real Decimal implementation at extremely large magnitudes.** An in-game formula may change independently of the shadow analyzer: the mismatch row is diagnostic, not a guarantee of source attribution completeness.

## Dimension view interaction

AD/ID/TD now share a single, inline Overall → tier-1…tier-8 view selector in the current analysis header. Previous/next arrows and the compact selector switch the root resource in place without adding tabs or changing `player.options.multiplierTab.currTab`; locked tiers are excluded and an invalid selected tier falls back to Overall. This is UI navigation only and does not change multiplier formulas.

## Save availability and remaining limitations

- AM production attribution remains APPROXIMATE. Direct AD1 amount × AD1 multiplier × one tickspeed rate × game speed is the displayed baseline. All production not described by that baseline, including NC12 additive AD2 output and nonlinear modifiers, is an explicitly labeled *accounting remainder*, not a gameplay upgrade. The real AM/sec display remains authoritative. AM arithmetic tests verify the remainder's basic reconciliation under finite mocked cases.
- TP represents current stock accrued historically. Decomposing that total into today's upgrade multipliers is generally invalid; this patch does not invent a TP history.
- ID/TD already had ordered per-tier traces in the input. Their source coverage is not exhaustively re-audited here; equal output alone does not prove correct attribution.
- Two current late-game saves (Overflow slot 1 #372 and Normal slot 3 #370) are now available and their AAB exports were decoded into JSON. Both contain eight AD tiers; the Overflow and Normal states differ in resource magnitudes and can form distinct validation fixtures. **Their presence and decode success do not constitute live formula reconciliation.** The supplied `src/` alone lacks the full build/runtime dependencies; real-save loading through the game's getters, arbitrary-magnitude Decimal calculations, and visual browser tests remain unperformed.
- Longer-term correctness: share formula-step definitions between gameplay and analysis, avoiding duplicated formula maintenance, and test real progression/save snapshots.
