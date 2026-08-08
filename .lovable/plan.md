# Estimating math audit — W. 150th ASC and the MetroHealth set

## Bottom line

The stored data is not wrong. I recalculated all 11 MetroHealth current revisions from their saved input fields using the exact formula in `calculateEstimate`, and every one matches its stored `monthly_price` to four decimals — including W. 150th ASC ($1,844.6233/mo, direct cost $1,224.3075, base price $1,632.41, floor care $212.2133).

So there is no data mismatch. The difference you see on the detail page comes from how the two screens produce their number, not from the numbers themselves.

## The two screens use different sources

| Screen | Source of the price |
|---|---|
| Estimating list (`src/pages/Estimating.tsx`) and opportunity-linked list (`LinkedEstimates.tsx`) | reads the stored snapshot column `estimate_revisions.monthly_price` |
| Estimate detail (`src/pages/EstimatingDetail.tsx`) | ignores every stored output column and recomputes live with `calculateEstimate(inputs)` from the hydrated input fields |

They only agree when the browser runs the same calculator version that wrote the snapshot. A client on an older bundle recomputes with the older formula while the list still shows the newer stored number.

## Most likely cause for W. 150th ASC specifically

W. 150th ASC is the only estimate in the set driven by `labor_hours_per_visit_override` (3.00 hr). That field was added recently. A cached client bundle that predates it drops the override and falls back to `max(3492 / 3500, 45/60)` = 0.998 hr/visit, recomputing to roughly $461/mo while the list still reads $1,844.62 from the snapshot. That matches the symptom shape exactly.

Confirming step: hard-refresh the detail page and read the "Hours / visit" line in the right panel. 3.00 hr means the client is current; ~1.00 hr means it is stale and this is the cause.

## Real code-level defects found regardless

1. **Snapshot columns are written incompletely on create.** `Estimating.tsx:130-146` and `LinkedEstimates.tsx:79-95` write the output list but omit `supervision_amount`, `base_monthly_price` and `periodic_floor_care_amount`, which the detail page's `OUTPUT_COLUMNS` does write. New estimates carry zero/stale values in those three columns until the first autosave.
2. **Asymmetric hydration defaults** (`EstimatingDetail.tsx:149-164`): `supply_preset` falls back to `'standard'` while `supply_rate_per_hour` falls back to `0`. A revision with a null preset renders with "Standard $0.55" visually selected while the math uses $0.00/hr. All 11 MetroHealth rows store `supply_preset = 'custom'` with rate 0, so they are unaffected today, but any row created outside the UI can land in this state — and the first edit autosaves the inconsistent pair.
3. **No drift detection.** Because the list trusts the snapshot and the detail trusts the formula, a formula change silently desynchronizes every previously saved estimate with no warning anywhere.

## Formula in use (`src/components/estimator/calc.ts`)

```text
visits        = cleanings_per_week * weeks_per_month
hours/visit   = override > 0 ? override
                             : max(square_feet / production_rate, minimum_visit_minutes / 60)
monthly hours = hours/visit * visits
loaded rate   = base_wage * (1 + labor_burden_percent/100)
direct cost   = monthly hours * loaded rate
              + monthly hours * base_wage * supervision_percent/100
              + monthly hours * supply_rate_per_hour
base price    = direct cost / (1 - overhead_percent/100 - target_margin_percent/100)
floor care    = base price * periodic_floor_care_percent/100
monthly price = base price + floor care
```

## Recommended fix (not applied — audit only)

1. Make the list page use the same source of truth as the detail page: select the full input set for each current revision and render `calculateEstimate(inputs).monthly_price`, falling back to the stored value only for specialty/project estimates. The two screens then cannot disagree.
2. Extract one shared `hydrateJanitorialInputs(rev)` helper used by both hydration and the create paths, with consistent defaults — derive `supply_preset` from the stored rate so the pair can never disagree.
3. Route all revision inserts through the same `OUTPUT_COLUMNS` writer so snapshots are always complete.
4. Optional: on the detail page, flag when the recomputed price differs from the stored snapshot by more than a cent, so future formula changes surface instead of hiding.

No files were changed for this audit.