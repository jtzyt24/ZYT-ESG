-- ============================================================
-- ZYT.ESG — Supabase Database Schema
-- Run this in: Supabase → SQL Editor → New query → Run
-- ============================================================
-- Version: 1.0 | June 2026
-- Frameworks: GHG Protocol · SGX Core ESG Metrics · SEFR Jan 2026
-- ============================================================

-- ── Extensions ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ============================================================
-- ZONE 1 — Company & reporting periods
-- ============================================================

-- Company profiles (one per SME, tied to auth.users)
create table if not exists profiles (
  id                      uuid primary key references auth.users on delete cascade,
  company_name            text not null,
  uen                     text,                    -- Singapore UEN (e.g. 202312345A)
  industry                text,                    -- fnb|retail|logistics|manufacturing|construction|ict|cleaning|healthcare|hospitality|other
  industry_sub            text,                    -- tier-2 sub-sector
  employee_count          text,                    -- 1-10|11-50|51-200|201-500|500+
  annual_revenue_sgd      numeric,                 -- optional, used for intensity metrics
  responsible_person_name text,
  responsible_person_role text,
  intent                  text,                    -- buyer|financing|cost|annual|ungc
  reporting_year          integer default 2024,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- Row-level security: each user sees only their own profile
alter table profiles enable row level security;
create policy "Users own their profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── Reporting periods (one per year per company) ────────────
create table if not exists reporting_periods (
  id                uuid primary key default uuid_generate_v4(),
  profile_id        uuid not null references profiles on delete cascade,
  year              integer not null,
  start_date        date,
  end_date          date,
  status            text default 'draft',          -- draft|complete|published
  completeness_score integer default 0,            -- 0-100
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (profile_id, year)
);

alter table reporting_periods enable row level security;
create policy "Users own their reporting periods"
  on reporting_periods for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ============================================================
-- ZONE 2 — Emissions data (Environmental pillar)
-- ============================================================

create table if not exists emissions_data (
  id                uuid primary key default uuid_generate_v4(),
  period_id         uuid not null references reporting_periods on delete cascade,

  -- Source classification
  cluster           text not null,                 -- power_energy|transport_fleet|cooling_refrigeration|cooking_heat|waste_water|people_commuting|digital_it|procurement
  activity_name     text not null,                 -- human-readable activity label
  activity_key      text,                          -- machine key, e.g. "grid_electricity_kwh"

  -- Quantity entered by user
  quantity          numeric,
  unit              text,                          -- kWh|L|kg|km|m3|instances|etc

  -- Emission factor (from SEFR or other)
  ef_value          numeric,                       -- kgCO2e per unit
  ef_unit           text,                          -- e.g. "kgCO2e/kWh"
  ef_source         text,                          -- e.g. "EMA 2023" | "NEA SEFR Jan 2026" | "MOT Singapore"
  sefr_factor_id    text,                          -- references emission_factors lookup (future)

  -- Calculated result
  emissions_kgco2e  numeric,                       -- quantity × ef_value

  -- GHG Protocol classification
  scope             integer check (scope in (1, 2, 3)),
  scope3_category   integer check (scope3_category between 1 and 15),  -- null for scope 1/2

  -- Cost (SGD) — for the "cost alongside carbon" design principle
  cost_sgd          numeric,
  cost_basis        text default 'estimated',      -- user_entered|reference_price|estimated

  -- Data quality
  data_quality      text default 'estimated',      -- measured|calculated|estimated
  accuracy_tag      text,                          -- monthly_complete|monthly_partial|annual|single_bill
  notes             text,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table emissions_data enable row level security;
create policy "Users own their emissions data"
  on emissions_data for all
  using (
    period_id in (
      select id from reporting_periods where profile_id = auth.uid()
    )
  );

-- Index for fast aggregation queries
create index if not exists idx_emissions_period    on emissions_data (period_id);
create index if not exists idx_emissions_scope     on emissions_data (period_id, scope);
create index if not exists idx_emissions_cluster   on emissions_data (period_id, cluster);

-- ============================================================
-- ZONE 3 — Social data (S pillar)
-- ============================================================

create table if not exists social_data (
  id                        uuid primary key default uuid_generate_v4(),
  period_id                 uuid not null references reporting_periods on delete cascade unique,

  -- Workforce (GRI 2-7, 405-1)
  total_employees           integer,
  employees_male            integer,
  employees_female          integer,
  employees_nonbinary       integer,
  employees_not_disclosed   integer,
  employees_under30         integer,
  employees_30to50          integer,
  employees_over50          integer,
  employees_fulltime        integer,
  employees_parttime        integer,

  -- Hiring & retention (GRI 401-1)
  new_hires                 integer,
  new_hires_male            integer,
  new_hires_female          integer,
  leavers                   integer,
  turnover_rate_pct         numeric,               -- auto-calculated

  -- Training (GRI 404-1)
  total_training_hours      numeric,
  training_hours_male       numeric,
  training_hours_female     numeric,
  avg_training_hours_per_emp numeric,              -- auto-calculated
  training_types            text[],               -- array of training type labels

  -- Health & safety (GRI 403-9, MOM categories)
  fatalities                integer default 0,
  high_consequence_injuries integer default 0,
  recordable_injuries       integer default 0,
  work_related_ill_health   integer,
  bizsafe_level             text,                  -- none|1|2|3|star

  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

alter table social_data enable row level security;
create policy "Users own their social data"
  on social_data for all
  using (
    period_id in (
      select id from reporting_periods where profile_id = auth.uid()
    )
  );

-- ============================================================
-- ZONE 4 — Governance data (G pillar)
-- ============================================================

create table if not exists governance_data (
  id                          uuid primary key default uuid_generate_v4(),
  period_id                   uuid not null references reporting_periods on delete cascade unique,

  -- ESG leadership
  esg_review_frequency        text,                -- monthly|quarterly|annually|ad_hoc
  mgmt_team_total             integer,
  mgmt_team_male              integer,
  mgmt_team_female            integer,
  mgmt_team_female_pct        numeric,             -- auto-calculated

  -- Ethics & compliance (GRI 205-2)
  anti_corruption_policy      boolean,
  anti_corruption_policy_desc text,
  staff_with_ac_training      integer,
  staff_ac_training_pct       numeric,             -- auto-calculated
  whistleblowing_channel      boolean,

  -- Certifications (SGX Core + Singapore-specific)
  certifications              text[],              -- e.g. ["ISO 14001", "bizSAFE Star"]

  -- Framework alignment (auto-populated, not user-editable)
  frameworks_declared         text[] default array['SGX Core ESG Metrics (Apr 2023)', 'GHG Protocol Corporate Standard'],
  assurance_type              text default 'none', -- none|internal|external|external_reasonable
  reporting_boundary          text default 'Operational control · Singapore operations',
  ef_source_statement         text default 'Singapore Emission Factors Registry (SEFR), NEA, January 2026',

  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

alter table governance_data enable row level security;
create policy "Users own their governance data"
  on governance_data for all
  using (
    period_id in (
      select id from reporting_periods where profile_id = auth.uid()
    )
  );

-- ============================================================
-- ZONE 5 — Targets
-- ============================================================

create table if not exists targets (
  id                  uuid primary key default uuid_generate_v4(),
  period_id           uuid not null references reporting_periods on delete cascade,
  profile_id          uuid not null references profiles on delete cascade,

  target_name         text,
  cluster             text,
  scope               integer,
  baseline_kgco2e     numeric,
  reduction_pct       integer,
  target_kgco2e       numeric,                     -- auto: baseline × (1 - reduction_pct/100)
  target_year         integer,
  annual_saving_sgd   numeric,                     -- estimated
  target_statement    text,                        -- formal "We commit to…" language

  status              text default 'committed',    -- committed|in_progress|achieved|revised

  created_at          timestamptz default now()
);

alter table targets enable row level security;
create policy "Users own their targets"
  on targets for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ============================================================
-- ZONE 6 — Reports
-- ============================================================

create table if not exists reports (
  id                      uuid primary key default uuid_generate_v4(),
  period_id               uuid not null references reporting_periods on delete cascade unique,
  version                 integer default 1,
  sustainability_context  text,                    -- user-edited narrative from S-23
  signatory_name          text,
  signatory_role          text,
  material_topics         text[],
  pdf_url                 text,                    -- Supabase storage URL (Phase 2)
  generated_at            timestamptz
);

alter table reports enable row level security;
create policy "Users own their reports"
  on reports for all
  using (
    period_id in (
      select id from reporting_periods where profile_id = auth.uid()
    )
  );

-- ============================================================
-- ZONE 7 — Actions log (Phase 2 — Activation)
-- ============================================================

create table if not exists actions_log (
  id                      uuid primary key default uuid_generate_v4(),
  profile_id              uuid not null references profiles on delete cascade,
  period_id               uuid references reporting_periods on delete set null,

  action_name             text not null,
  cluster                 text,
  status                  text default 'planned',  -- planned|in_progress|completed
  cost_sgd                numeric,
  actual_saving_sgd       numeric,
  actual_reduction_kgco2e numeric,
  completion_date         date,
  notes                   text,

  created_at              timestamptz default now()
);

alter table actions_log enable row level security;
create policy "Users own their actions"
  on actions_log for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ============================================================
-- ZONE 8 — Lead capture (ZYT advisory)
-- ============================================================

create table if not exists leads (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid references profiles on delete set null,
  source_screen   text,                            -- S-26|S-27|S-25
  tier_interest   text,                            -- diy|guided|managed
  message         text,
  email           text,
  contacted_at    timestamptz,
  created_at      timestamptz default now()
);

-- Leads are readable by the ZYT admin service role only
alter table leads enable row level security;
create policy "Users can insert leads"
  on leads for insert
  with check (profile_id = auth.uid());
create policy "Users can read their own leads"
  on leads for select
  using (profile_id = auth.uid());

-- ============================================================
-- REFERENCE TABLES (ZYT-maintained, read-only in app)
-- ============================================================

-- Emission factors (from SEFR + EMA + MOT + PUB)
create table if not exists emission_factors (
  id              text primary key,                -- e.g. "EMA_GRID_2023" | "SEFR_DIESEL_COMBUSTION"
  category        text,                            -- fuel|electricity|transport|waste|water|refrigerant|cloud
  subcategory     text,
  activity_name   text not null,
  ef_value        numeric not null,                -- kgCO2e per unit
  ef_unit         text not null,                   -- e.g. "kgCO2e/kWh"
  source          text,                            -- e.g. "EMA Singapore" | "NEA SEFR Jan 2026"
  standard        text,                            -- e.g. "2006 IPCC Guidelines"
  sefr_version    text,                            -- e.g. "Jan 2026"
  scope           integer,
  scope3_category integer,
  cluster         text,                            -- maps to operational cluster
  active          boolean default true,
  effective_from  date,
  notes           text
);

-- Reference prices (SGD, quarterly updated by ZYT)
create table if not exists reference_prices (
  id              text primary key,
  item            text not null,                   -- e.g. "diesel_per_litre" | "electricity_kwh_exgst"
  price_sgd       numeric not null,
  unit            text,
  source          text,
  effective_date  date,
  updated_at      timestamptz default now()
);

-- ============================================================
-- SEED DATA — Emission factors (key SEFR + EMA values)
-- ============================================================

insert into emission_factors (id, category, activity_name, ef_value, ef_unit, source, sefr_version, scope, cluster) values

-- Electricity (Scope 2)
('EMA_GRID_2023',          'electricity', 'Singapore grid electricity (location-based)', 0.412,     'kgCO2e/kWh', 'EMA, Singapore', NULL,      2, 'power_energy'),
('SEFR_ELEC_UPSTREAM',     'electricity', 'Grid electricity — upstream Cat 3 (T&D)',     0.00212,   'kgCO2e/kWh', 'EMA via SEFR',   'Jan 2026', 3, 'power_energy'),

-- Fuels — Scope 1 (per litre, density-converted from SEFR t-based)
('SEFR_DIESEL_L',          'fuel', 'Gas/diesel oil combustion',          2.660,   'kgCO2e/L',   'NEA/SEFR', 'Jan 2026', 1, 'transport_fleet'),
('SEFR_PETROL_L',          'fuel', 'Motor gasoline (petrol) combustion', 2.295,   'kgCO2e/L',   'NEA/SEFR', 'Jan 2026', 1, 'transport_fleet'),
('SEFR_LPG_L',             'fuel', 'LPG combustion (per litre)',         1.644,   'kgCO2e/L',   'NEA/SEFR', 'Jan 2026', 1, 'cooking_heat'),
('SEFR_LPG_KG',            'fuel', 'LPG combustion (per kg)',            2.987,   'kgCO2e/kg',  'NEA/SEFR', 'Jan 2026', 1, 'cooking_heat'),
('SEFR_LPG_12KG_CYL',      'fuel', 'LPG 12kg cylinder (hawker/domestic)',35.85,   'kgCO2e/cyl', 'NEA/SEFR', 'Jan 2026', 1, 'cooking_heat'),
('SEFR_LPG_48KG_CYL',      'fuel', 'LPG 48kg cylinder (commercial kitchen)',143.39,'kgCO2e/cyl','NEA/SEFR', 'Jan 2026', 1, 'cooking_heat'),
('SEFR_PIPED_GAS_KWH',     'fuel', 'Natural gas / piped gas combustion', 0.202,   'kgCO2e/kWh', 'NEA/SEFR', 'Jan 2026', 1, 'cooking_heat'),
('SEFR_CHARCOAL_KG',       'fuel', 'Charcoal combustion',                0.196,   'kgCO2e/kg',  'NEA/SEFR', 'Jan 2026', 1, 'cooking_heat'),

-- Refrigerants — Scope 1 fugitive (GWP × kg leaked)
('SEFR_R32_GWP',           'refrigerant', 'R-32 refrigerant leakage',   675,     'kgCO2e/kg',  'NEA SEFR / IPCC AR6', 'Jan 2026', 1, 'cooling_refrigeration'),
('SEFR_R410A_GWP',         'refrigerant', 'R-410A refrigerant leakage', 2088,    'kgCO2e/kg',  'NEA SEFR / IPCC AR5', 'Jan 2026', 1, 'cooling_refrigeration'),
('SEFR_R134A_GWP',         'refrigerant', 'R-134a refrigerant leakage', 1430,    'kgCO2e/kg',  'NEA SEFR / IPCC AR5', 'Jan 2026', 1, 'cooling_refrigeration'),
('SEFR_R404A_GWP',         'refrigerant', 'R-404A refrigerant leakage', 3922,    'kgCO2e/kg',  'NEA SEFR / IPCC AR5', 'Jan 2026', 1, 'cooling_refrigeration'),
('SEFR_R22_GWP',           'refrigerant', 'R-22 refrigerant leakage',   1760,    'kgCO2e/kg',  'NEA SEFR / IPCC AR5', 'Jan 2026', 1, 'cooling_refrigeration'),
('SEFR_R407C_GWP',         'refrigerant', 'R-407C refrigerant leakage', 1774,    'kgCO2e/kg',  'NEA SEFR / IPCC AR5', 'Jan 2026', 1, 'cooling_refrigeration'),

-- Transport — Scope 3 (MOT Singapore, per person-km)
('MOT_MRT_PKM',            'transport', 'MRT / LRT (commuting)',        0.0416,  'kgCO2e/p-km','MOT, Singapore', NULL, 3, 'people_commuting'),
('MOT_BUS_PKM',            'transport', 'Public bus (commuting)',       0.0737,  'kgCO2e/p-km','MOT, Singapore', NULL, 3, 'people_commuting'),
('MOT_CAR_ICE_PKM',        'transport', 'Private car — petrol/diesel',  0.1732,  'kgCO2e/p-km','MOT, Singapore', NULL, 3, 'people_commuting'),
('MOT_CAR_HEV_PKM',        'transport', 'Private car — hybrid',         0.1212,  'kgCO2e/p-km','MOT, Singapore', NULL, 3, 'people_commuting'),
('MOT_CAR_EV_PKM',         'transport', 'Private car — electric (EV)',  0.0875,  'kgCO2e/p-km','MOT, Singapore', NULL, 3, 'people_commuting'),
('MOT_MOTORCYCLE_PKM',     'transport', 'Motorcycle / scooter',         0.1050,  'kgCO2e/p-km','MOT, Singapore', NULL, 3, 'people_commuting'),
('MOT_TAXI_GRAB_PKM',      'transport', 'Taxi / ride-hailing (petrol)', 0.1732,  'kgCO2e/p-km','MOT, Singapore', NULL, 3, 'transport_fleet'),

-- Freight (Scope 3 Cat 4/9)
('SEFR_FREIGHT_ROAD_TKM',  'transport', 'Road freight (3PL, inbound)',  0.0621,  'kgCO2e/t-km','NEA/SEFR', 'Jan 2026', 3, 'transport_fleet'),
('SEFR_FREIGHT_SEA_TKM',   'transport', 'Sea freight (container)',      0.0116,  'kgCO2e/t-km','NEA/SEFR', 'Jan 2026', 3, 'transport_fleet'),
('SEFR_FREIGHT_AIR_TKM',   'transport', 'Air freight',                  0.602,   'kgCO2e/t-km','NEA/SEFR', 'Jan 2026', 3, 'transport_fleet'),

-- Business flights (Scope 3 Cat 6) — short/long haul with RFI
('DEFRA_FLIGHT_DOM_PKM',   'transport', 'Domestic flight (per passenger-km)',   0.133, 'kgCO2e/p-km','DEFRA 2024', NULL, 3, 'transport_fleet'),
('DEFRA_FLIGHT_SHORT_PKM', 'transport', 'Short-haul flight (<3700km)',          0.153, 'kgCO2e/p-km','DEFRA 2024', NULL, 3, 'transport_fleet'),
('DEFRA_FLIGHT_LONG_PKM',  'transport', 'Long-haul flight (>3700km)',           0.148, 'kgCO2e/p-km','DEFRA 2024', NULL, 3, 'transport_fleet'),

-- Waste (Scope 3 Cat 5 — NEA Singapore incineration)
('NEA_WASTE_GENERAL_KG',   'waste', 'General waste (incineration)',     0.4670,  'kgCO2e/kg',  'NEA, Singapore', NULL, 3, 'waste_water'),
('NEA_WASTE_FOOD_KG',      'waste', 'Food waste (incineration)',        0.5698,  'kgCO2e/kg',  'NEA, Singapore', NULL, 3, 'waste_water'),
('NEA_WASTE_PLASTIC_KG',   'waste', 'Plastics waste (incineration)',    2.8933,  'kgCO2e/kg',  'NEA, Singapore', NULL, 3, 'waste_water'),
('NEA_WASTE_PAPER_KG',     'waste', 'Paper waste (incineration)',       0.6600,  'kgCO2e/kg',  'NEA, Singapore', NULL, 3, 'waste_water'),
('NEA_WASTE_METAL_KG',     'waste', 'Metal waste (incineration)',       0.0060,  'kgCO2e/kg',  'NEA, Singapore', NULL, 3, 'waste_water'),
('NEA_WASTE_GLASS_KG',     'waste', 'Glass waste (incineration)',       0.0070,  'kgCO2e/kg',  'NEA, Singapore', NULL, 3, 'waste_water'),

-- Water (Scope 3 Cat 1)
('PUB_WATER_M3',           'water', 'PUB mains water consumption',     0.5662,  'kgCO2e/m3',  'PUB, Singapore', NULL, 3, 'waste_water'),

-- Cloud / digital (Scope 3 Cat 1 — IMDA Singapore)
('IMDA_CLOUD_HOT_GB',      'digital', 'Cloud storage — hot tier',        0.0000335,'kgCO2e/GB-month','IMDA, Singapore', NULL, 3, 'digital_it'),
('IMDA_CLOUD_COLD_GB',     'digital', 'Cloud storage — cold tier',       0.0000084,'kgCO2e/GB-month','IMDA, Singapore', NULL, 3, 'digital_it'),
('IMDA_VM_GENERAL_HR',     'digital', 'VM — general purpose (instance-hour)',0.000533,'kgCO2e/hr','IMDA, Singapore', NULL, 3, 'digital_it'),
('IMDA_VM_COMPUTE_HR',     'digital', 'VM — compute-optimised',          0.000712,'kgCO2e/hr',  'IMDA, Singapore', NULL, 3, 'digital_it'),
('IMDA_VM_MEMORY_HR',      'digital', 'VM — memory-optimised',           0.000623,'kgCO2e/hr',  'IMDA, Singapore', NULL, 3, 'digital_it')

on conflict (id) do update
  set ef_value = excluded.ef_value,
      source   = excluded.source;

-- ============================================================
-- SEED DATA — Reference prices (SGD, Q2 2026)
-- ============================================================

insert into reference_prices (id, item, price_sgd, unit, source, effective_date) values
('ELEC_NONDOM_EXGST',   'SP Group electricity — non-domestic ex-GST',    0.2727, 'SGD/kWh',    'SP Group / SingStat M890991, Q2 2026', '2026-04-01'),
('ELEC_NONDOM_INCGST',  'SP Group electricity — non-domestic incl-GST',  0.2972, 'SGD/kWh',    'SP Group × 1.09 GST',                 '2026-04-01'),
('DIESEL_PUMP',         'Diesel — Singapore pump reference',              2.80,   'SGD/litre',  'ZYT market reference, Q2 2026',       '2026-04-01'),
('PETROL_95_PUMP',      'Petrol 95 — Singapore pump reference',           2.95,   'SGD/litre',  'ZYT market reference, Q2 2026',       '2026-04-01'),
('LPG_12KG_CYL',        'LPG 12kg cylinder',                              28.00,  'SGD/cylinder','ZYT market reference, Q2 2026',      '2026-04-01'),
('LPG_48KG_CYL',        'LPG 48kg cylinder',                              95.00,  'SGD/cylinder','ZYT market reference, Q2 2026',      '2026-04-01'),
('PIPED_GAS_KWH',       'Piped gas — commercial rate',                    0.0825, 'SGD/kWh',    'ZYT market reference, Q2 2026',       '2026-04-01'),
('PUB_WATER_M3',        'PUB water — non-domestic',                       1.99,   'SGD/m3',     'PUB, Q2 2026',                        '2026-04-01')

on conflict (id) do update
  set price_sgd = excluded.price_sgd,
      effective_date = excluded.effective_date,
      updated_at = now();

-- ============================================================
-- VIEWS — Pre-built aggregations for the app
-- ============================================================

-- Scope totals per reporting period
create or replace view v_scope_totals as
select
  period_id,
  sum(case when scope = 1 then emissions_kgco2e else 0 end) as scope1_kgco2e,
  sum(case when scope = 2 then emissions_kgco2e else 0 end) as scope2_kgco2e,
  sum(case when scope = 3 then emissions_kgco2e else 0 end) as scope3_kgco2e,
  sum(emissions_kgco2e)                                     as total_kgco2e,
  sum(cost_sgd)                                             as total_cost_sgd
from emissions_data
group by period_id;

-- Emissions by cluster per period
create or replace view v_cluster_totals as
select
  period_id,
  cluster,
  sum(emissions_kgco2e) as cluster_kgco2e,
  sum(cost_sgd)         as cluster_cost_sgd,
  count(*)              as activity_count
from emissions_data
group by period_id, cluster;

-- Full company ESG summary (joins all tables)
create or replace view v_esg_summary as
select
  p.id                  as profile_id,
  p.company_name,
  p.industry,
  p.employee_count,
  rp.year,
  rp.status,
  rp.completeness_score,
  vst.scope1_kgco2e,
  vst.scope2_kgco2e,
  vst.scope3_kgco2e,
  vst.total_kgco2e,
  vst.total_cost_sgd,
  sd.total_employees,
  sd.fatalities,
  sd.recordable_injuries,
  sd.total_training_hours,
  gd.anti_corruption_policy,
  gd.mgmt_team_female_pct,
  gd.assurance_type
from profiles p
join reporting_periods rp   on rp.profile_id = p.id
left join v_scope_totals vst on vst.period_id = rp.id
left join social_data sd     on sd.period_id = rp.id
left join governance_data gd on gd.period_id = rp.id;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply trigger to all mutable tables
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger trg_periods_updated_at
  before update on reporting_periods
  for each row execute function update_updated_at();

create trigger trg_emissions_updated_at
  before update on emissions_data
  for each row execute function update_updated_at();

create trigger trg_social_updated_at
  before update on social_data
  for each row execute function update_updated_at();

create trigger trg_governance_updated_at
  before update on governance_data
  for each row execute function update_updated_at();

-- Auto-calculate derived fields on social_data insert/update
create or replace function calc_social_derived()
returns trigger language plpgsql as $$
begin
  -- Turnover rate
  if new.total_employees > 0 and new.leavers is not null then
    new.turnover_rate_pct := round((new.leavers::numeric / new.total_employees * 100)::numeric, 1);
  end if;
  -- Avg training hours per employee
  if new.total_employees > 0 and new.total_training_hours is not null then
    new.avg_training_hours_per_emp := round((new.total_training_hours / new.total_employees)::numeric, 1);
  end if;
  return new;
end;
$$;

create trigger trg_social_calc
  before insert or update on social_data
  for each row execute function calc_social_derived();

-- Auto-calculate management team female %
create or replace function calc_governance_derived()
returns trigger language plpgsql as $$
begin
  if new.mgmt_team_total > 0 and new.mgmt_team_female is not null then
    new.mgmt_team_female_pct := round((new.mgmt_team_female::numeric / new.mgmt_team_total * 100)::numeric, 0);
  end if;
  return new;
end;
$$;

create trigger trg_governance_calc
  before insert or update on governance_data
  for each row execute function calc_governance_derived();

-- ============================================================
-- Done. Run this once in Supabase SQL Editor.
-- Your ZYT.ESG database is ready.
-- ============================================================
