// ============================================================
// ZYT.ESG — Supabase client (email + password auth only)
// ============================================================
// SETUP: Replace the two values below with your Supabase credentials.
// Supabase dashboard → your project → Settings → API
//
//   SUPABASE_URL = Project URL  (https://xxxx.supabase.co)
//   SUPABASE_KEY = anon/public key (safe to expose in browser)
// ============================================================

const SUPABASE_URL = 'https://hgwsadwrhhedyaljnpbg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnd3NhZHdyaGhlZHlhbGpucGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MzcyMTIsImV4cCI6MjA5NjQxMzIxMn0.Z-6ektpgxn8JMafxGGYcQkdrHx9TtZpduxJHGwj8LMo';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Auth ────────────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'S-05-login.html';
    return null;
  }
  return session;
}

export async function signUp(email, password) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      // After the user clicks the confirmation link in their email, Supabase
      // redirects here. S-05 auto-detects the active session and routes the
      // newly confirmed user to S-06 (no profile yet) or S-09 (returning).
      emailRedirectTo: new URL('S-05-login.html', window.location.href).href,
    },
  });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

export async function resetPassword(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL('S-05-login.html', window.location.href).href
  });
}

// ── localStorage helpers ─────────────────────────────────────
// All screens use localStorage as primary storage.
// When a session exists, data also syncs to Supabase.

export function saveLocal(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
}

export function loadLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { return null; }
}

// ── Profile helpers ──────────────────────────────────────────

export async function upsertProfile(userId, profileData) {
  return supabase
    .from('esg_profiles')
    .upsert({ id: userId, ...profileData, updated_at: new Date().toISOString() });
}

export async function getProfile(userId) {
  return supabase.from('esg_profiles').select('*').eq('id', userId).single();
}

// ── Reporting period helpers ─────────────────────────────────

export async function getOrCreatePeriod(profileId, year) {
  let { data, error } = await supabase
    .from('esg_reporting_periods')
    .select('*').eq('profile_id', profileId).eq('year', year).single();
  if (error?.code === 'PGRST116') {
    const result = await supabase
      .from('esg_reporting_periods')
      .insert({ profile_id: profileId, year, start_date: `${year}-01-01`, end_date: `${year}-12-31`, status: 'draft' })
      .select().single();
    return result;
  }
  return { data, error };
}

// ── Emissions helpers ────────────────────────────────────────

export async function upsertEmissions(periodId, cluster, rows) {
  // Guard: never DELETE without replacement rows. An empty-entries save (e.g.
  // after a failed restore) must not silently wipe valid Supabase data.
  if (!rows?.length) return { data: null, error: null };
  await supabase.from('esg_emissions_data').delete()
    .eq('period_id', periodId).eq('cluster', cluster);
  return supabase.from('esg_emissions_data')
    .insert(rows.map(r => ({ ...r, period_id: periodId })));
}

export async function getEmissionTotals(periodId) {
  const { data, error } = await supabase
    .from('esg_emissions_data').select('scope, emissions_kgco2e, cost_sgd')
    .eq('period_id', periodId);
  if (error) return { error };
  const totals = { scope1: 0, scope2: 0, scope3: 0, totalCostSgd: 0 };
  (data || []).forEach(r => {
    if (r.scope === 1) totals.scope1 += r.emissions_kgco2e || 0;
    if (r.scope === 2) totals.scope2 += r.emissions_kgco2e || 0;
    if (r.scope === 3) totals.scope3 += r.emissions_kgco2e || 0;
    totals.totalCostSgd += r.cost_sgd || 0;
  });
  return { data: totals };
}

// ── Social & Governance helpers ──────────────────────────────

export async function upsertSocialData(periodId, data) {
  return supabase.from('esg_social_data').upsert({
    period_id:                  periodId,
    total_employees:            data.totalEmployees,
    employees_male:             data.employeesMale,
    employees_female:           data.employeesFemale,
    employees_nonbinary:        data.employeesNonbinary,
    employees_not_disclosed:    data.employeesNotDisclosed,
    employees_under30:          data.employeesUnder30,
    employees_30to50:           data.employees30to50,
    employees_over50:           data.employeesOver50,
    employees_fulltime:         data.employeesFulltime,
    employees_parttime:         data.employeesParttime,
    new_hires:                  data.newHires,
    new_hires_male:             data.newHiresMale,
    new_hires_female:           data.newHiresFemale,
    leavers:                    data.leavers,
    turnover_rate_pct:          data.turnoverRatePct,
    total_training_hours:       data.totalTrainingHours,
    training_hours_male:        data.trainingHoursMale,
    training_hours_female:      data.trainingHoursFemale,
    avg_training_hours_per_emp: data.avgTrainingHoursPerEmp,
    training_types:             data.trainingTypes,
    fatalities:                 data.fatalities,
    high_consequence_injuries:  data.highConsequenceInjuries,
    recordable_injuries:        data.recordableInjuries,
    work_related_ill_health:    data.workRelatedIllHealth,
    bizsafe_level:              data.bizsafeLevel,
    updated_at:                 new Date().toISOString(),
  }, { onConflict: 'period_id' });
}

export async function upsertGovernanceData(periodId, data) {
  return supabase.from('esg_governance_data').upsert({
    period_id:                   periodId,
    esg_review_frequency:        data.esgReviewFrequency,
    mgmt_team_total:             data.mgmtTeamTotal,
    mgmt_team_male:              data.mgmtTeamMale,
    mgmt_team_female:            data.mgmtTeamFemale,
    mgmt_team_female_pct:        data.mgmtTeamFemalePct,
    anti_corruption_policy:      data.anticorruptionPolicy,
    anti_corruption_policy_desc: data.anticorruptionPolicyDesc,
    staff_with_ac_training:      data.staffWithAcTraining,
    staff_ac_training_pct:       data.staffAcTrainingPct,
    whistleblowing_channel:      data.whistleblowingChannel,
    certifications:              data.certifications,
    assurance_status:            data.assuranceType,
    updated_at:                  new Date().toISOString(),
  }, { onConflict: 'period_id' });
}

// ── Targets helpers ──────────────────────────────────────────

export async function upsertTargets(periodId, targets) {
  // Delete-then-insert (same pattern as emissions — each save is a full replacement)
  await supabase.from('esg_targets').delete().eq('period_id', periodId);
  if (!targets?.length) return { data: null, error: null };
  return supabase.from('esg_targets').insert(
    targets.map(t => ({
      period_id:     periodId,
      target_id:     t.id,
      cluster_id:    t.clusterId,
      carbon_kgco2e: parseFloat(t.carbon)  || null,
      saving_sgd:    parseFloat(t.saving)  || null,
      payback_years: parseFloat(t.payback) || null,
      reduction_pct: parseFloat(t.pct)     || null,
      target_year:   parseInt(t.year)      || null,
      statement:     t.statement || '',
      updated_at:    new Date().toISOString(),
    }))
  );
}

export async function hydrateTargetsFromSupabase(periodId) {
  const { data: rows, error } = await supabase
    .from('esg_targets').select('*').eq('period_id', periodId);
  if (error || !rows?.length) return false;
  const targets = rows.map(r => ({
    id:        r.target_id,
    clusterId: r.cluster_id,
    carbon:    String(r.carbon_kgco2e  ?? ''),
    saving:    String(r.saving_sgd     ?? ''),
    payback:   String(r.payback_years  ?? ''),
    pct:       String(r.reduction_pct  ?? ''),
    year:      String(r.target_year    ?? ''),
    statement: r.statement || '',
  }));
  localStorage.setItem('zyt_targets_data', JSON.stringify({ targets, savedAt: Date.now() }));
  return true;
}

// ── Context helpers ──────────────────────────────────────────

export async function upsertContextData(periodId, data) {
  return supabase.from('esg_context_data').upsert({
    period_id:              periodId,
    sustainability_context: data.narrative,
    material_topics:        data.materialTopics,
    signatory_name:         data.signatoryName,
    signatory_role:         data.signatoryRole,
    intent:                 data.intent || null,
    updated_at:             new Date().toISOString(),
  }, { onConflict: 'period_id' });
}

export async function hydrateContextFromSupabase(periodId) {
  const { data: row, error } = await supabase
    .from('esg_context_data').select('*').eq('period_id', periodId).maybeSingle();
  if (error || !row) return false;
  const data = {
    narrative:      row.sustainability_context || '',
    materialTopics: row.material_topics || [],
    signatoryName:  row.signatory_name  || '',
    signatoryRole:  row.signatory_role  || '',
    intent:         row.intent          || '',
  };
  localStorage.setItem('zyt_context_data', JSON.stringify(data));
  return true;
}

// ── Sync helpers (called on each screen save) ────────────────
// These fail silently if no session — localStorage always works.

export async function syncProfileToSupabase(profileData) {
  const session = await getSession();
  if (!session) return;
  await upsertProfile(session.user.id, profileData);
}

export async function syncSocialToSupabase(socialData) {
  const session = await getSession();
  if (!session) return;
  const periodId = loadLocal('zyt_period_id');
  if (!periodId) return;
  await upsertSocialData(periodId, socialData);
}

export async function syncGovernanceToSupabase(govData) {
  const session = await getSession();
  if (!session) return;
  const periodId = loadLocal('zyt_period_id');
  if (!periodId) return;
  await upsertGovernanceData(periodId, govData);
}

export async function syncTargetsToSupabase(targets) {
  const session = await getSession();
  if (!session) return;
  const periodId = loadLocal('zyt_period_id');
  if (!periodId) return;
  await upsertTargets(periodId, targets);
}

export async function syncContextToSupabase(contextData) {
  const session = await getSession();
  if (!session) return;
  const periodId = loadLocal('zyt_period_id');
  if (!periodId) return;
  await upsertContextData(periodId, contextData);
}
