# ZYT.ESG — Project Status

**Purpose of this file:** if this zip is re-uploaded to Claude in a future
session, read this file first. It captures current architecture state,
what's been retrofitted, what hasn't, and known issues — so Claude doesn't
need the full conversation history to get oriented.

**Last updated:** 2026-06-14

---

## Live deployment

- **URL:** https://zyt-esg.netlify.app/
- **Hosting:** Netlify, deployed via GitHub Desktop (push to repo → auto-deploy)
- **Backend:** Supabase project `hgwsadwrhhedyaljnpbg` (free tier, `ap-southeast-1` likely)
  — credentials are already filled in at `js/supabase.js` lines 11–12
- **Auth:** Email + password only (Google OAuth removed). Custom SMTP via Resend
  is configured in Supabase dashboard (Authentication → SMTP Settings).
- **Free tier note:** Supabase free projects auto-pause after 7 days of
  inactivity. Not yet automated — visit the dashboard periodically, or set up
  a free UptimeRobot/cron-job.org ping to `https://hgwsadwrhhedyaljnpbg.supabase.co/rest/v1/`.

---

## Architecture status

### Foundation layer — `js/zyt-core/` (built 2026-06-14, adopted by all 8 emission clusters)

- **`config.js`** — `INDUSTRY_LABELS`, `INDUSTRY_RELEVANCE`, `CLUSTERS`, `NAV_MAP`,
  `FRAMEWORKS` + `applyFrameworkVisibility()`. **S-10–S-17 all import `goTo()`
  from here** for Save & Next / Save & Exit navigation. S-09, S-18, and other
  screens still have inline duplicates (e.g. S-18's `clusterMap`) — candidates
  for the next cleanup pass.
- **`schema.js`** — canonical shapes for every `zyt_*` localStorage key,
  field-matched to `database.sql`, with PDPA personal-data classification per
  field. **S-10–S-17 all use `createClusterData()`, `createEmissionEntry()`,
  `saveClusterData()`, `loadClusterData()`** — every emission cluster is on
  the real contract. **Next addition needed: an `aggregateClusters()` helper**
  for S-18/S-19 (see "Recommended next session" below).
- **`DATA_INVENTORY.md`** — DPE Step 2.1 Data Inventory Map, generated from
  `schema.js`. Headline: only 2 personal-data fields in the entire schema
  (`responsiblePerson` name, `signatoryName`). Review this whenever schema.js
  changes.

**Status: foundation built and reviewed. S-10 retrofit COMPLETE (2026-06-14) —
proves the pattern. S-11, S-12, S-13, S-14, S-15, S-16, S-17 retrofits COMPLETE
(2026-06-14). All 8 emission clusters now save real `EmissionEntry[]` via
`schema.js`. Next major milestone: S-18/S-19 aggregation (see below).**

### Screens — retrofit status

| Screen | Status |
|---|---|
| S-02 intent selector | Working, navigates to S-03. Sets `zyt_intent*` keys. Not yet using `config.js` FRAMEWORKS/NAV_MAP. |
| S-03/04/05 auth | Working (email+password, Resend SMTP). Built fresh this project, not legacy. |
| S-06 company profile | Fixed 2026-06-14: loads saved profile on revisit instead of overwriting with demo data. Saves `companyName, uen, companySize, industry, reportingYear, responsiblePerson, responsiblePersonRole` to `zyt_company_profile`. Not yet using `schema.js` factories. |
| S-09 data entry hub | Fixed 2026-06-14: header reads company name/year/industry dynamically via `initFromProfile()`. `INDUSTRY_RELEVANCE`/`INDUSTRY_LABELS` are inlined here — **should be replaced by import from `config.js`** in next retrofit pass. Cluster "done" status checks `localStorage` presence only — now that S-10 saves real `entries[]`, S-09 could (but doesn't yet) read actual `emissionsKgCo2e`/`costSgd` totals from S-10's saved data. |
| **S-10 Power & energy** | **RETROFITTED 2026-06-14.** Module script, imports `schema.js` + `config.js`. `saveAndNext()`/`saveAndExit()` build real `EmissionEntry[]` via `buildEntriesFromState()` (grid electricity, upstream Cat 3 auto-calc, solar offset, district cooling, diesel generator — each with `emissionsKgCo2e`, `costSgd`, `efSource`, `dataQuality`) and persist via `saveClusterData('power', data)`. On load, `restoreFromSaved()` repopulates the form from `loadClusterData('power')` — electricity via Annual mode (lossless), generator via annual-total field, solar via monthly field. **Known limitation:** district cooling restore is approximate — the original RT-hr/kWh-thermal input isn't stored, only the electricity-equivalent kWh; on restore, the total is correct but the detailed DC input field is left blank for re-entry. Removed hardcoded demo prefill (was `es-kwh=360, es-bill=94.68` from the user's actual SP bill — replaced with real persistence). |
| **S-11 Transport & fleet** | **RETROFITTED 2026-06-14.** Module script, imports `schema.js` + `config.js`. `buildEntriesFromState()` covers: company vehicles (Scope 1, multi-fuel: petrol/diesel/LPG/CNG/EV, dynamically added), inbound freight Cat 4 (tonne-km or spend-based), outbound delivery Cat 9 (parcel-km or spend), business flights Cat 6 (per-flight, `ROUTES` distance table, ICAO factors ×2 RFI, custom routes), Grab/taxi Cat 6, personal vehicle Cat 6 (reimbursed or staff-km), hotel stays Cat 6. `restoreFromSaved()` uses a `parseNotes()` helper to round-trip multi-field activities (tonnes/km/trips, route/pax/cabin, staff/km-per-week/weeks) — more complete restore fidelity than S-10 since no lossy unit-mode collapsing is needed. |
| **S-12 Cooling & refrigeration** | **RETROFITTED 2026-06-14.** Module script, imports `schema.js` + `config.js`. Three sections, all Scope 1 refrigerant leakage: air-conditioning (always present), cold room/freezer (optional, N/A toggle), reefer vehicles (optional, N/A toggle). Each section: select refrigerant type (R-410A, R-32, R-22, R-407C, R-134a, R-404A, or "other" with manual GWP entry) → GWP-based `efValue`/`efSource` via `REF_EF_SOURCE` map → top-up quantity in kg, either direct or via "visits × kg per visit". `restoreFromSaved()` uses `parseNotes()` + `selectRefByName()` to restore refrigerant selection, manual GWP, and input mode (kg vs visits) per section. |
| **S-13 Cooking & process heat** | **RETROFITTED 2026-06-14.** Module script, imports `schema.js` + `config.js`. Four Scope 1 sections: town gas (piped, `piped_gas_kwh`), LPG (`lpg_bulk` or `lpg_cylinders`), diesel/fuel oil boiler (`boiler_fuel`), charcoal/other solid fuel (`charcoal_solid_fuel`). Each maps to an `EmissionEntry` with appropriate unit/EF/cost. |
| **S-14 Waste & water** | **RETROFITTED 2026-06-14.** Module script, imports `schema.js` + `config.js`. Five Scope 3 sections, all Cat 5 except water (Cat 1): general/mixed waste (`general_waste_kg` — by bags/bins/weight/spend, each mode preserved via `notes` for restore), food waste (`food_waste_kg` — bags or weight, `costSgd` represents food value wasted not disposal fee, flagged via `costMeaning=food_value_wasted` in notes), plastics (`plastics_waste_kg`), verified recyclables (`recyclables_verified_kg` — a regular low-EF entry, not an offset; represents waste diverted from incineration via a verified recycler contract), and PUB water (`pub_water_m3`, restored via Annual mode like S-10's electricity). `restoreFromSaved()` uses `parseNotes()` + `selectByDataKg()` to restore bag/bin size selections and input mode per section. **Bug fixed:** previously saved to the wrong localStorage key (`zyt_s14_waste_water_data` instead of `zyt_waste_data` via `schema.js`'s `CLUSTER_STORAGE_KEYS`) — S-09 was never detecting this cluster as complete. Removed hardcoded demo prefill (3 bags/day general waste, 11.8 m³ water). |
| **S-15 People & commuting** | **RETROFITTED 2026-06-14.** Module script, imports `schema.js` + `config.js`. All Scope 3 Cat 7 (employee commuting). Public transport: "by mode" (up to 3 entries — `commute_mrt`/`commute_bus`/`commute_mixed`, each with its own EF) or "simple estimate" (`commute_pt_simple`, single EF from a dropdown). Private vehicle: up to 4 entries (`commute_car_petrol`/`commute_car_hybrid`/`commute_car_ev`/`commute_motorcycle`), N/A toggle. WFH electricity (`commute_wfh_electricity`) — same equipment-wattage methodology as S-10's WFH calculator, N/A toggle. `restoreFromSaved()` uses `parseNotes()` to restore staff/km per mode and `workingDays` (shared across PT and vehicle calcs via `getWD()`). **Critical bug fixed:** the entire screen's script tag had a syntax error — `saveAndNext()` was referenced by the "Save & continue" button but its `function` declaration was missing (only the body remained as a dangling block), which meant the **whole script failed to parse and none of the calculators, toggles, or tabs worked at all**. Also fixed the wrong-localStorage-key bug (was `zyt_s15_people_commuting_data`, now `zyt_commuting_data` via `CLUSTER_STORAGE_KEYS.people`). Removed hardcoded demo prefill (6 staff × 14km MRT, 2 staff × 12km car). |
| **S-16 Digital & IT** | **RETROFITTED 2026-06-14.** Module script, imports `schema.js` + `config.js`. Three sections: cloud services (Cat 1) — either spend-based (`cloud_services_spend`, ~0.2 kgCO2e/SGD spend-based EEIO proxy) or provider carbon footprint report (`cloud_services_provider_report`, direct tCO2e figure from AWS/GCP/Azure/Alibaba's own tooling, `dataQuality='measured'` since it's the provider's actual measurement rather than an estimate); IT hardware capex (Cat 2) — one `it_hardware_<type>` entry per dynamically-added equipment row (laptop/desktop/server/phone/tablet/monitor/printer/other), each with embodied-carbon EF and reference purchase price; co-location/hosted servers (Cat 1) — `colocation_servers_kwh`, monthly kWh × PUE × grid EF. `restoreFromSaved()` recreates hardware rows via `addHWItem()` before setting each row's type/qty. Also fixed the "Save & continue" button, which previously wrote a `{saved:true}` placeholder directly inline instead of calling a real save function (the localStorage key itself, `zyt_digital_data`, was already correct). |
| **S-17 Procurement** | **RETROFITTED 2026-06-14 — last of the 8 emission clusters.** Module script, imports `schema.js` + `config.js`. Four spend-based Scope 3 Cat 1 sections, each a single `EmissionEntry`: packaging materials (`packaging_materials_spend`, with material-type EF selectable from 4 options — cardboard/plastic/mixed/compostable, restored via `notes.ef`), cleaning & facility services (`cleaning_facility_spend`, fixed 0.15 kgCO2e/SGD), professional & business services (`professional_services_spend`, fixed 0.08 kgCO2e/SGD), other purchased goods (`other_purchased_goods_spend`, with category EF selectable from 5 options — food/manufacturing/retail/office/general, restored via `notes.ef`). All EFs sourced from PACT-3.0/EEIO SEA (already cited in the page's own UI, not in `database.sql`'s SEFR-based `emission_factors` table). Simplest retrofit of the 8 — no multi-mode inputs or dynamic lists, just spend × EF for each section. Also fixed the "Save & continue" button (was an inline `{saved:true}` placeholder; the localStorage key `zyt_procurement_data` was already correct). |

**🎉 All 8 emission-data clusters (S-10–S-17) now persist real, schema-conformant `EmissionEntry[]` data with proper `scope`/`scope3Category`/`efSource`/`costSgd`/`dataQuality` fields, full restore-on-revisit, and working "Save & exit". This was the core architectural goal of the retrofit project.**
| S-18 review/confirm | Navigation wired (cluster edit links go to correct screens via inline `clusterMap` — duplicate of `NAV_MAP`, should be replaced). Does not yet aggregate real `EmissionEntry[]` from S-10. |
| S-19 carbon overview | Working with demo/illustrative numbers — depends on S-10–17 retrofit + S-19 aggregation logic for real data. S-10 now has real numbers available via `loadClusterData('power')`. |
| S-21 target setting | Navigation wired to S-23. Saves `zyt_targets_data` — shape roughly matches `schema.js` `createTargetsData()`, not yet verified field-by-field. |
| S-23 sustainability context | Navigation wired. **`zyt_context_data` shape in schema.js is a best-guess from `reports` table — not yet verified against this screen's actual save logic.** |
| S-24 report preview | Working, 11-section report with sticky TOC. |
| S-25 generate | Working, UNGC CoP banner present. |
| S-31/32 social, S-33 governance | Working, save to `zyt_social_data` / `zyt_governance_data`. Field names not yet cross-checked against `schema.js` `createSocialData()`/`createGovernanceData()` — likely close but unverified. |

---

## Known gaps / honest limitations

1. **No real emissions calculations.** S-10–S-17 don't compute `emissions_kgco2e`
   or `cost_sgd` — S-19's totals are illustrative until this is built.
2. **No Supabase sync yet.** Everything is localStorage-only. `schema.js` has
   `*ToDbRow()` mappers ready, but nothing calls them — `js/supabase.js` has
   the helper functions (`upsertProfile`, `upsertEmissions`, etc.) but screens
   don't call them on save.
3. **TR 149:2026 not yet integrated.** `FRAMEWORKS.tr149` exists in `config.js`
   as a stub (`storageFlag: 'zyt_intent_tr149'`) but nothing sets this flag, and
   no TR149-specific fields exist in any screen yet. See prior TR149 compliance
   assessment (Level 2-3 achievable across most domains, gaps in supply network
   and product life cycle — both correctly out of scope for non-manufacturing SMEs).
4. **`zyt_context_data` shape unverified** (see S-23 row above).

---

## Recommended next session

**The aggregation layer (S-18 and S-19) is now the only major remaining piece.**
All 8 clusters write `EmissionEntry[]` to `localStorage` via `schema.js` — S-18
and S-19 both still render entirely from hardcoded `DEMO` objects and never
read this data. Suggested approach:

1. Add an `aggregateClusters()` function to `schema.js` (single source of
   truth, used by both S-18 and S-19):
   - Loop over `CLUSTER_STORAGE_KEYS`, call `loadClusterData()` for each,
     collect all `entries[]`
   - Sum `emissionsKgCo2e` grouped by `scope` (1/2/3) and by
     `scope3Category` (1–9) for Scope 3 breakdowns
   - Sum `costSgd` per cluster and overall
   - Per-cluster status: `'complete'` if `entries.length > 0`, `'na'` if the
     cluster was visited and explicitly marked N/A throughout (no entries but
     `saved: true`), `'not_started'` if `loadClusterData()` returns null
   - Per-cluster accuracy: derive from the `dataQuality` mix of that
     cluster's entries (e.g. all `'measured'` → high, mix → medium, all
     `'estimated'` → low) — same three-tier system S-18's DEMO already uses
2. Retrofit S-18 (Review & confirm): replace `DEMO.clusters[]` with
   `aggregateClusters()` output, mapped to the same `{id, icon, name, sub,
   s1, s2, s3, sgd, status, acc, scopes, notes}` shape `renderClusters()`
   already expects — so the rendering logic itself may need minimal changes.
   Replace the inline `clusterMap` in `goToCluster()` with `NAV_MAP` from
   `config.js`.
3. Retrofit S-19 (Carbon overview): replace `DEMO` with real
   `scope1_kgco2e`/`scope2_kgco2e`/`scope3_kgco2e` totals and build
   `s1_sources`/`s2_sources`/`s3_sources` by grouping entries by
   `activityName` (or `activityKey`) within each scope, summing
   `emissionsKgCo2e`. Keep `benchmark_median_kgco2e`/`benchmark_best_kgco2e`
   as static reference values (no per-company source for these). `revenue_sgd`
   should come from `zyt_company_profile` if available.
4. Once S-18/S-19 show real numbers end-to-end, do a full click-through test:
   fill in 2-3 clusters with real data via the browser, confirm S-09 → S-18 →
   S-19 reflect it correctly, then mark remaining clusters N/A and confirm
   `status` handling is correct.
5. Lower-priority cleanup once the above is solid: retrofit S-09 to import
   `config.js` directly (remove inline `INDUSTRY_RELEVANCE`/`INDUSTRY_LABELS`/
   cluster screenMap) and read real `emissionsKgCo2e`/`costSgd` totals via
   `aggregateClusters()` instead of just checking presence; verify
   `zyt_context_data`/`zyt_social_data`/`zyt_governance_data` shapes in
   `schema.js` against S-23/S-31-32/S-33's actual save logic.

---

## File manifest

```
zyt-deploy/
├── index.html                          # Landing page
├── netlify.toml                        # Redirects, headers, caching
├── database.sql                        # Supabase schema (source of truth for data shapes)
├── DATA_INVENTORY.md                   # DPE Step 2.1 — personal data inventory
├── PROJECT_STATUS.md                   # This file
├── css/
│   └── zyt.css                         # Shared design tokens (not yet imported by screens)
├── js/
│   ├── supabase.js                     # Supabase client + helpers (credentials filled in)
│   └── zyt-core/
│       ├── config.js                   # Industry/nav/framework config (adopted by S-10, S-11)
│       └── schema.js                   # Canonical data shapes / "the contract" (adopted by S-10, S-11)
├── S-02-intent-selector.html
├── S-03-signup.html
├── S-04-check-email.html
├── S-05-login.html
├── S-06-company-profile.html           # Fixed 2026-06-14
├── S-09-data-entry-hub.html            # Fixed 2026-06-14
├── S-10-power-energy-v3.html           # RETROFITTED 2026-06-14
├── S-11-transport-fleet.html           # RETROFITTED 2026-06-14
├── S-12-cooling-refrigeration.html     # RETROFITTED 2026-06-14
├── S-13-cooking-process-heat.html      # RETROFITTED 2026-06-14
├── S-14-waste-water.html               # RETROFITTED 2026-06-14
├── S-15-people-commuting.html          # RETROFITTED 2026-06-14
├── S-16-digital-it.html                 # RETROFITTED 2026-06-14
├── S-17-procurement.html                # RETROFITTED 2026-06-14
├── S-18-review-confirm.html              # NEXT TARGET — aggregate real data (still DEMO)
├── S-19-carbon-overview.html             # ALSO TARGET — aggregate real data (still DEMO)
├── S-21-target-setting.html
├── S-23-sustainability-context.html
├── S-24-report-preview.html
├── S-25-generate.html
├── S-31-32-social.html
└── S-33-governance.html
```
