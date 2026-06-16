// ============================================================
// ZYT.ESG — js/zyt-core/schema.js
// ============================================================
// THE CONTRACT.
//
// This file defines the canonical shape of every `zyt_*`
// localStorage key, field-for-field against the matching
// table in database.sql. Screens read/write ONLY through the
// factory functions and helpers below — never construct or
// mutate these objects ad-hoc.
//
// Each field carries a classification tag for PDPA / DPE
// compliance (see DATA_INVENTORY.md, generated from this file):
//
//   'personal'   — identifies or could identify a natural person
//                   (DPE Step 2.1: must appear in the Data Inventory Map)
//   'aggregate'   — statistical counts/percentages; not personal data
//                   even though the underlying source data may be
//   'business'    — business-confidential but not personal data
//                   (e.g. revenue, emissions figures)
//
// If you add a field, you MUST add its classification.
// Reviewers: this file is the thing to review before screens
// are retrofitted against it.
// ============================================================

// ============================================================
// 1. COMPANY PROFILE — zyt_company_profile
// Mirrors: profiles table
// ============================================================

/**
 * @typedef {Object} CompanyProfile
 * @property {string} companyName            [personal? no — business name] -> profiles.company_name
 * @property {string} uen                    [business] -> profiles.uen
 * @property {string} companySize            [business] -> profiles.employee_count
 * @property {string} industry               [business] -> profiles.industry
 * @property {string} reportingYear          [business] -> profiles.reporting_year
 * @property {string} responsiblePerson      [PERSONAL — name of an individual] -> profiles.responsible_person_name
 * @property {string} responsiblePersonRole  [business] -> profiles.responsible_person_role
 */

export function createCompanyProfile() {
  return {
    companyName: '',
    uen: '',
    companySize: '',
    industry: '',
    reportingYear: String(new Date().getFullYear()),
    responsiblePerson: '',
    responsiblePersonRole: '',
  };
}

/** Maps a CompanyProfile to a profiles table row for Supabase sync. */
export function profileToDbRow(profile, userId) {
  return {
    id: userId,
    company_name: profile.companyName,
    uen: profile.uen,
    employee_count: profile.companySize,
    industry: profile.industry,
    reporting_year: parseInt(profile.reportingYear, 10) || new Date().getFullYear(),
    responsible_person_name: profile.responsiblePerson,
    responsible_person_role: profile.responsiblePersonRole,
  };
}

/** Reads the saved CompanyProfile from localStorage, or null if none saved yet. */
export function loadCompanyProfile() {
  const raw = localStorage.getItem('zyt_company_profile');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// ============================================================
// 2. INTENT — zyt_intent, zyt_intent_ungc, zyt_intent_pcr
// Mirrors: profiles.intent
// ============================================================

/**
 * @typedef {Object} Intent
 * @property {string} intent  [business] one of: buyer|financing|cost|annual|ungc -> profiles.intent
 * @property {boolean} ungc   [business] derived flag, drives FRAMEWORKS.ungc
 * @property {boolean} pcr    [business] derived flag, drives FRAMEWORKS.pcr
 */

export function createIntent() {
  return { intent: '', ungc: false, pcr: false };
}

export function saveIntent(intent) {
  localStorage.setItem('zyt_intent', intent.intent);
  localStorage.setItem('zyt_intent_ungc', String(!!intent.ungc));
  localStorage.setItem('zyt_intent_pcr', String(!!intent.pcr));
}

export function loadIntent() {
  return {
    intent: localStorage.getItem('zyt_intent') || '',
    ungc: localStorage.getItem('zyt_intent_ungc') === 'true',
    pcr: localStorage.getItem('zyt_intent_pcr') === 'true',
  };
}

// ============================================================
// 3. EMISSIONS CLUSTER DATA — zyt_power_data, zyt_transport_data,
//    zyt_cooling_data, zyt_cooking_data, zyt_waste_data,
//    zyt_commuting_data, zyt_digital_data, zyt_procurement_data
// Mirrors: emissions_data table (one row per EmissionEntry)
// ============================================================

/**
 * @typedef {Object} EmissionEntry
 * @property {string} activityName     [business] -> emissions_data.activity_name
 * @property {string} activityKey      [business] -> emissions_data.activity_key
 * @property {number|null} quantity    [business] -> emissions_data.quantity
 * @property {string} unit             [business] -> emissions_data.unit
 * @property {number|null} efValue     [business] -> emissions_data.ef_value
 * @property {string} efUnit           [business] -> emissions_data.ef_unit
 * @property {string} efSource         [business] -> emissions_data.ef_source
 * @property {number|null} emissionsKgCo2e [business] -> emissions_data.emissions_kgco2e
 * @property {1|2|3} scope             [business] -> emissions_data.scope
 * @property {number|null} scope3Category [business] -> emissions_data.scope3_category
 * @property {number|null} costSgd     [business] -> emissions_data.cost_sgd
 * @property {string} costBasis        [business] user_entered|reference_price|estimated -> emissions_data.cost_basis
 * @property {string} dataQuality      [business] measured|calculated|estimated -> emissions_data.data_quality
 * @property {string} notes            [business — could contain personal data if user types a name; treat as personal if non-empty]
 */

/**
 * @typedef {Object} ClusterData
 * @property {string} clusterId        [business] one of CLUSTERS[].id from config.js
 * @property {boolean} saved           [business] true once user has completed this cluster
 * @property {EmissionEntry[]} entries [business] line items, mirrors emissions_data rows for this cluster
 * @property {string} updatedAt        [business] ISO timestamp
 */

export function createClusterData(clusterId) {
  return {
    clusterId,
    saved: false,
    entries: [],
    updatedAt: null,
  };
}

export function createEmissionEntry() {
  return {
    activityName: '',
    activityKey: '',
    quantity: null,
    unit: '',
    efValue: null,
    efUnit: '',
    efSource: '',
    emissionsKgCo2e: null,
    scope: 3,
    scope3Category: null,
    costSgd: null,
    costBasis: 'estimated',
    dataQuality: 'estimated',
    notes: '',
  };
}

// localStorage key for each cluster — single source of truth,
// replaces the storageMap previously duplicated in S-09.
export const CLUSTER_STORAGE_KEYS = {
  power: 'zyt_power_data',
  transport: 'zyt_transport_data',
  cooling: 'zyt_cooling_data',
  cooking: 'zyt_cooking_data',
  waste: 'zyt_waste_data',
  people: 'zyt_commuting_data',
  digital: 'zyt_digital_data',
  procurement: 'zyt_procurement_data',
};

export function saveClusterData(clusterId, data) {
  const key = CLUSTER_STORAGE_KEYS[clusterId];
  if (!key) throw new Error(`Unknown cluster: ${clusterId}`);
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadClusterData(clusterId) {
  const key = CLUSTER_STORAGE_KEYS[clusterId];
  if (!key) throw new Error(`Unknown cluster: ${clusterId}`);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/** Maps an EmissionEntry to an emissions_data table row for Supabase sync. */
export function emissionEntryToDbRow(entry, periodId, clusterId) {
  return {
    period_id: periodId,
    cluster: clusterId,
    activity_name: entry.activityName,
    activity_key: entry.activityKey,
    quantity: entry.quantity,
    unit: entry.unit,
    ef_value: entry.efValue,
    ef_unit: entry.efUnit,
    ef_source: entry.efSource,
    emissions_kgco2e: entry.emissionsKgCo2e,
    scope: entry.scope,
    scope3_category: entry.scope3Category,
    cost_sgd: entry.costSgd,
    cost_basis: entry.costBasis,
    data_quality: entry.dataQuality,
    notes: entry.notes,
  };
}

/** Reverse of emissionEntryToDbRow() — maps an emissions_data row back to an EmissionEntry. */
export function dbRowToEmissionEntry(row) {
  return {
    activityName: row.activity_name || '',
    activityKey: row.activity_key || '',
    quantity: row.quantity,
    unit: row.unit || '',
    efValue: row.ef_value,
    efUnit: row.ef_unit || '',
    efSource: row.ef_source || '',
    emissionsKgCo2e: row.emissions_kgco2e,
    scope: row.scope,
    scope3Category: row.scope3_category,
    costSgd: row.cost_sgd,
    costBasis: row.cost_basis || 'estimated',
    dataQuality: row.data_quality || 'estimated',
    notes: row.notes || '',
  };
}

/**
 * Fetches all emissions_data rows for a period from Supabase, groups them by
 * cluster, and writes a ClusterData object to localStorage for each of the
 * 8 clusters (via saveClusterData()) — the reverse of what S-10–S-17's
 * syncToSupabase() does on save. Used by S-05 on login to hydrate a
 * returning user's cluster data from Supabase onto a new device/browser.
 * Clusters with no rows in Supabase are left untouched (not overwritten
 * with an empty ClusterData) so any local-only draft isn't clobbered.
 * Returns the number of clusters hydrated.
 */
export async function hydrateClustersFromSupabase(supabaseClient, periodId) {
  const { data: rows, error } = await supabaseClient
    .from('emissions_data')
    .select('*')
    .eq('period_id', periodId);
  if (error || !rows) return 0;

  const byCluster = {};
  for (const row of rows) {
    if (!byCluster[row.cluster]) byCluster[row.cluster] = [];
    byCluster[row.cluster].push(dbRowToEmissionEntry(row));
  }

  let count = 0;
  for (const [clusterId, entries] of Object.entries(byCluster)) {
    if (!CLUSTER_STORAGE_KEYS[clusterId]) continue; // unknown cluster id, skip
    const data = createClusterData(clusterId);
    data.saved = true;
    data.entries = entries;
    saveClusterData(clusterId, data);
    count++;
  }
  return count;
}

// ============================================================
// 4. SOCIAL DATA — zyt_social_data
// Mirrors: social_data table
// All fields are AGGREGATE COUNTS — no individual employee
// records are collected. This keeps social_data out of PDPA
// "personal data" scope entirely.
// ============================================================

/**
 * @typedef {Object} SocialData
 * All fields [aggregate] -> social_data.<same name, snake_case>
 */

export function createSocialData() {
  return {
    // Workforce (GRI 2-7, 405-1)
    totalEmployees: null,
    employeesMale: null,
    employeesFemale: null,
    employeesNonbinary: null,
    employeesNotDisclosed: null,
    employeesUnder30: null,
    employees30to50: null,
    employeesOver50: null,
    employeesFulltime: null,
    employeesParttime: null,

    // Hiring & retention (GRI 401-1)
    newHires: null,
    newHiresMale: null,
    newHiresFemale: null,
    leavers: null,
    turnoverRatePct: null, // auto-calculated

    // Training (GRI 404-1)
    totalTrainingHours: null,
    trainingHoursMale: null,
    trainingHoursFemale: null,
    avgTrainingHoursPerEmp: null, // auto-calculated
    trainingTypes: [], // array of strings

    // Health & safety (GRI 403-9, MOM categories)
    fatalities: 0,
    highConsequenceInjuries: 0,
    recordableInjuries: 0,
    workRelatedIllHealth: null,
    bizsafeLevel: 'none', // none|1|2|3|star
  };
}

const SOCIAL_FIELD_MAP = {
  totalEmployees: 'total_employees',
  employeesMale: 'employees_male',
  employeesFemale: 'employees_female',
  employeesNonbinary: 'employees_nonbinary',
  employeesNotDisclosed: 'employees_not_disclosed',
  employeesUnder30: 'employees_under30',
  employees30to50: 'employees_30to50',
  employeesOver50: 'employees_over50',
  employeesFulltime: 'employees_fulltime',
  employeesParttime: 'employees_parttime',
  newHires: 'new_hires',
  newHiresMale: 'new_hires_male',
  newHiresFemale: 'new_hires_female',
  leavers: 'leavers',
  turnoverRatePct: 'turnover_rate_pct',
  totalTrainingHours: 'total_training_hours',
  trainingHoursMale: 'training_hours_male',
  trainingHoursFemale: 'training_hours_female',
  avgTrainingHoursPerEmp: 'avg_training_hours_per_emp',
  trainingTypes: 'training_types',
  fatalities: 'fatalities',
  highConsequenceInjuries: 'high_consequence_injuries',
  recordableInjuries: 'recordable_injuries',
  workRelatedIllHealth: 'work_related_ill_health',
  bizsafeLevel: 'bizsafe_level',
};

export function socialDataToDbRow(data, periodId) {
  const row = { period_id: periodId };
  for (const [jsKey, dbKey] of Object.entries(SOCIAL_FIELD_MAP)) {
    row[dbKey] = data[jsKey];
  }
  return row;
}

export function saveSocialData(data) {
  localStorage.setItem('zyt_social_data', JSON.stringify(data));
}

export function loadSocialData() {
  const raw = localStorage.getItem('zyt_social_data');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// ============================================================
// 5. GOVERNANCE DATA — zyt_governance_data
// Mirrors: governance_data table
// All fields are AGGREGATE COUNTS or business policy flags —
// not personal data.
// ============================================================

export function createGovernanceData() {
  return {
    esgReviewFrequency: '', // monthly|quarterly|annually|ad_hoc
    mgmtTeamTotal: null,
    mgmtTeamMale: null,
    mgmtTeamFemale: null,
    mgmtTeamFemalePct: null, // auto-calculated

    anticorruptionPolicy: false,
    anticorruptionPolicyDesc: '',
    staffWithAcTraining: null,
    staffAcTrainingPct: null, // auto-calculated
    whistleblowingChannel: false,

    certifications: [], // e.g. ["ISO 14001", "bizSAFE Star"]
  };
}

const GOVERNANCE_FIELD_MAP = {
  esgReviewFrequency: 'esg_review_frequency',
  mgmtTeamTotal: 'mgmt_team_total',
  mgmtTeamMale: 'mgmt_team_male',
  mgmtTeamFemale: 'mgmt_team_female',
  mgmtTeamFemalePct: 'mgmt_team_female_pct',
  anticorruptionPolicy: 'anti_corruption_policy',
  anticorruptionPolicyDesc: 'anti_corruption_policy_desc',
  staffWithAcTraining: 'staff_with_ac_training',
  staffAcTrainingPct: 'staff_ac_training_pct',
  whistleblowingChannel: 'whistleblowing_channel',
  certifications: 'certifications',
};

export function governanceDataToDbRow(data, periodId) {
  const row = { period_id: periodId };
  for (const [jsKey, dbKey] of Object.entries(GOVERNANCE_FIELD_MAP)) {
    row[dbKey] = data[jsKey];
  }
  return row;
}

export function saveGovernanceData(data) {
  localStorage.setItem('zyt_governance_data', JSON.stringify(data));
}

export function loadGovernanceData() {
  const raw = localStorage.getItem('zyt_governance_data');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/** Reverse of socialDataToDbRow() — maps a social_data row back to a SocialData object. */
export function dbRowToSocialData(row) {
  const data = createSocialData();
  for (const [jsKey, dbKey] of Object.entries(SOCIAL_FIELD_MAP)) {
    if (row[dbKey] !== undefined) data[jsKey] = row[dbKey];
  }
  return data;
}

/** Reverse of governanceDataToDbRow() — maps a governance_data row back to a GovernanceData object. */
export function dbRowToGovernanceData(row) {
  const data = createGovernanceData();
  for (const [jsKey, dbKey] of Object.entries(GOVERNANCE_FIELD_MAP)) {
    if (row[dbKey] !== undefined) data[jsKey] = row[dbKey];
  }
  return data;
}

/**
 * Fetches social_data and governance_data rows for a period from Supabase
 * and writes them to localStorage (via saveSocialData()/saveGovernanceData())
 * if present. Used by S-05 on login alongside hydrateClustersFromSupabase().
 * Returns { social: boolean, governance: boolean } indicating what was hydrated.
 */
export async function hydrateSocialGovernanceFromSupabase(supabaseClient, periodId) {
  const result = { social: false, governance: false };

  const { data: socialRow } = await supabaseClient
    .from('social_data').select('*').eq('period_id', periodId).maybeSingle();
  if (socialRow) {
    saveSocialData(dbRowToSocialData(socialRow));
    result.social = true;
  }

  const { data: govRow } = await supabaseClient
    .from('governance_data').select('*').eq('period_id', periodId).maybeSingle();
  if (govRow) {
    saveGovernanceData(dbRowToGovernanceData(govRow));
    result.governance = true;
  }

  return result;
}

// ============================================================
// 6. TARGETS — zyt_targets_data
// Mirrors: targets table (array of target rows)
// ============================================================

/**
 * @typedef {Object} Target
 * All fields [business] -> targets.<same name, snake_case>
 */

export function createTarget() {
  return {
    targetName: '',
    cluster: '',
    scope: null,
    baselineKgCo2e: null,
    reductionPct: null,
    targetKgCo2e: null, // auto: baseline * (1 - reductionPct/100)
    targetYear: null,
    annualSavingSgd: null,
    targetStatement: '',
    status: 'committed', // committed|in_progress|achieved|revised
  };
}

export function createTargetsData() {
  return { targets: [], savedAt: null };
}

export function saveTargetsData(data) {
  data.savedAt = Date.now();
  localStorage.setItem('zyt_targets_data', JSON.stringify(data));
}

export function loadTargetsData() {
  const raw = localStorage.getItem('zyt_targets_data');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// ============================================================
// 7. SUSTAINABILITY CONTEXT — zyt_context_data
// Mirrors: reports.sustainability_context, reports.material_topics,
//          reports.signatory_name, reports.signatory_role
//
// NOTE: signatoryName is PERSONAL DATA (an individual's name
// appearing on a public-facing report). This is the one field
// in the whole schema that is both personal AND intentionally
// disclosed (it appears in the published report by design,
// with the user's knowledge — same pattern as a DPO contact
// per DPE Step 1).
// ============================================================

/**
 * @typedef {Object} ContextData
 * @property {string} narrative        [business] free-text sustainability narrative -> reports.sustainability_context
 * @property {string[]} materialTopics [business] -> reports.material_topics
 * @property {string} signatoryName    [PERSONAL — published with user's knowledge] -> reports.signatory_name
 * @property {string} signatoryRole    [business] -> reports.signatory_role
 */

export function createContextData() {
  return {
    narrative: '',
    materialTopics: [],
    signatoryName: '',
    signatoryRole: '',
  };
}

export function contextDataToDbRow(data, periodId) {
  return {
    period_id: periodId,
    sustainability_context: data.narrative,
    material_topics: data.materialTopics,
    signatory_name: data.signatoryName,
    signatory_role: data.signatoryRole,
  };
}

export function saveContextData(data) {
  localStorage.setItem('zyt_context_data', JSON.stringify(data));
}

export function loadContextData() {
  const raw = localStorage.getItem('zyt_context_data');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// ============================================================
// 8. AGGREGATION — used by S-18 (review/confirm) and S-19 (carbon overview)
// ============================================================
// Single source of truth for combining EmissionEntry[] across all 8
// emissions clusters into scope/category totals, per-cluster summaries,
// and grouped source breakdowns. Both S-18 and S-19 should call
// aggregateClusters() rather than reading localStorage directly.
// ============================================================

/**
 * Categorizes a Scope 1 entry as 'fuel' (combustion) or 'fugitive'
 * (refrigerant leakage), for the Scope 1 cat-breakdown on S-18.
 */
function scope1Category(entry) {
  return (entry.activityKey || '').startsWith('refrigerant_') ? 'fugitive' : 'fuel';
}

/**
 * Categorizes a Scope 2 entry as 'grid' (grid electricity, including the
 * on-site solar offset) or 'dc' (district cooling), for the Scope 2
 * cat-breakdown on S-18.
 */
function scope2Category(entry) {
  return entry.activityKey === 'district_cooling_kwh_equiv' ? 'dc' : 'grid';
}

/**
 * Derives a 3-tier accuracy rating from the dataQuality mix of a cluster's
 * entries — same three-tier system S-18 displays in "Data quality summary":
 *  - all entries 'measured'  -> 'high'
 *  - all entries 'estimated' -> 'low'
 *  - mixed, or any 'calculated' -> 'medium'
 *  - no entries -> 'none'
 */
function deriveAccuracy(entries) {
  if (!entries || entries.length === 0) return 'none';
  const qualities = new Set(entries.map(e => e.dataQuality));
  if (qualities.size === 1) {
    if (qualities.has('measured')) return 'high';
    if (qualities.has('estimated')) return 'low';
  }
  return 'medium';
}

/**
 * Aggregates EmissionEntry[] from all 8 clusters into scope/category totals,
 * per-cluster summaries, and grouped source lists.
 *
 * @returns {{
 *   clusters: Object.<string, {
 *     s1: number, s2: number, s3: number, sgd: number,
 *     status: 'complete'|'na'|'not_started',
 *     acc: 'high'|'medium'|'low'|'none',
 *     entryCount: number,
 *     scopesPresent: string[]
 *   }>,
 *   scope1_kgco2e: number, scope2_kgco2e: number, scope3_kgco2e: number,
 *   scope1_sgd: number, scope2_sgd: number, scope3_sgd: number,
 *   total_kgco2e: number, total_sgd: number,
 *   scope1_fuel_kgco2e: number, scope1_fugitive_kgco2e: number,
 *   scope2_grid_kgco2e: number, scope2_dc_kgco2e: number,
 *   scope3_by_category: Object.<number, number>,
 *   s1_sources: {name: string, kgco2e: number}[],
 *   s2_sources: {name: string, kgco2e: number}[],
 *   s3_sources: {name: string, kgco2e: number}[]
 * }}
 *
 * - s1/s2/s3 (per-cluster and overall) are in kgCO2e. A cluster's `s3`
 *   includes entries of ALL scope3Category values for that cluster
 *   (e.g. Power's Cat-3 upstream electricity is folded into its s3).
 * - status: 'complete' if the cluster has any entries, 'na' if the
 *   cluster was visited and saved with zero entries (explicitly marked
 *   not applicable), 'not_started' if the cluster has never been saved.
 * - scopesPresent lists which of s1/s2/s3 have non-zero entries for
 *   that cluster, e.g. ['s2','s3'].
 * - s1_sources/s2_sources/s3_sources group entries by activityName
 *   across all clusters, summing emissionsKgCo2e, sorted descending.
 */
export function aggregateClusters() {
  const clusters = {};
  let scope1_kgco2e = 0, scope2_kgco2e = 0, scope3_kgco2e = 0;
  let scope1_sgd = 0, scope2_sgd = 0, scope3_sgd = 0;
  let scope1_fuel_kgco2e = 0, scope1_fugitive_kgco2e = 0;
  let scope2_grid_kgco2e = 0, scope2_dc_kgco2e = 0;
  const scope3_by_category = {};
  // Keyed by "activityName|||clusterId" so the same activity name in two
  // different clusters doesn't merge into one row — needed because the
  // report table (S-24) shows a "Cluster" column per source line.
  const sourceMaps = { 1: new Map(), 2: new Map(), 3: new Map() };

  for (const clusterId of Object.keys(CLUSTER_STORAGE_KEYS)) {
    const data = loadClusterData(clusterId);
    let s1 = 0, s2 = 0, s3 = 0, sgd = 0;
    let status, acc, entryCount = 0;

    if (data === null) {
      status = 'not_started';
      acc = 'none';
    } else {
      const entries = data.entries || [];
      entryCount = entries.length;

      if (entryCount === 0) {
        status = data.saved ? 'na' : 'not_started';
        acc = 'none';
      } else {
        status = 'complete';
        acc = deriveAccuracy(entries);
      }

      for (const e of entries) {
        const kg = e.emissionsKgCo2e || 0;
        const cost = e.costSgd || 0;
        const name = e.activityName || e.activityKey || 'Unnamed activity';
        const sourceKey = `${name}|||${clusterId}`;
        sgd += cost;

        if (e.scope === 1) {
          s1 += kg;
          scope1_kgco2e += kg;
          scope1_sgd += cost;
          if (scope1Category(e) === 'fugitive') scope1_fugitive_kgco2e += kg;
          else scope1_fuel_kgco2e += kg;
          const prev = sourceMaps[1].get(sourceKey);
          sourceMaps[1].set(sourceKey, { name, clusterId, kgco2e: (prev?.kgco2e || 0) + kg });
        } else if (e.scope === 2) {
          s2 += kg;
          scope2_kgco2e += kg;
          scope2_sgd += cost;
          if (scope2Category(e) === 'dc') scope2_dc_kgco2e += kg;
          else scope2_grid_kgco2e += kg;
          const prev = sourceMaps[2].get(sourceKey);
          sourceMaps[2].set(sourceKey, { name, clusterId, kgco2e: (prev?.kgco2e || 0) + kg });
        } else {
          s3 += kg;
          scope3_kgco2e += kg;
          scope3_sgd += cost;
          if (e.scope3Category) {
            scope3_by_category[e.scope3Category] = (scope3_by_category[e.scope3Category] || 0) + kg;
          }
          const prev = sourceMaps[3].get(sourceKey);
          sourceMaps[3].set(sourceKey, { name, clusterId, scope3Category: e.scope3Category || null, kgco2e: (prev?.kgco2e || 0) + kg });
        }
      }
    }

    const scopesPresent = [];
    if (s1 > 0) scopesPresent.push('s1');
    if (s2 > 0) scopesPresent.push('s2');
    if (s3 > 0) scopesPresent.push('s3');

    clusters[clusterId] = { s1, s2, s3, sgd, status, acc, entryCount, scopesPresent };
  }

  const toSourceList = (map) =>
    [...map.values()].sort((a, b) => b.kgco2e - a.kgco2e);

  return {
    clusters,
    scope1_kgco2e, scope2_kgco2e, scope3_kgco2e,
    scope1_sgd, scope2_sgd, scope3_sgd,
    total_kgco2e: scope1_kgco2e + scope2_kgco2e + scope3_kgco2e,
    total_sgd: scope1_sgd + scope2_sgd + scope3_sgd,
    scope1_fuel_kgco2e, scope1_fugitive_kgco2e,
    scope2_grid_kgco2e, scope2_dc_kgco2e,
    scope3_by_category,
    s1_sources: toSourceList(sourceMaps[1]),
    s2_sources: toSourceList(sourceMaps[2]),
    s3_sources: toSourceList(sourceMaps[3]),
  };
}

// ============================================================
// HOUSEKEEPING KEYS (not part of the data contract — UI state only)
// ============================================================
//
// zyt_draft_saved   — timestamp, UI feedback only, not synced
// zyt_auth_skipped  — boolean, UI flag for "continue without account"
// zyt_period_id     — uuid, cached reporting_periods.id once Supabase sync exists
//
// These do not need factory functions — they are simple primitives
// read/written directly where needed.
