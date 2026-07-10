// ============================================================
// ZYT.ESG — Supabase client (email + password auth only)
// ============================================================
// SETUP: Replace the two values below with your Supabase credentials.
// Supabase dashboard → your project → Settings → API
//
//   SUPABASE_URL = Project URL  (https://xxxx.supabase.co)
//   SUPABASE_KEY = anon/public key (safe to expose in browser)
// ============================================================

const SUPABASE_URL = 'https://ojjfwlldwazndznwuyzc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qamZ3bGxkd2F6bmR6bnd1eXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk1NDksImV4cCI6MjA5MTc0NTU0OX0.SukWx_DHH1hYJGOVC5GjZURZR0ASe6e5OxmS78OnMEI';

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
  return supabase.auth.signUp({ email, password });
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
  await supabase.from('esg_emissions_data').delete()
    .eq('period_id', periodId).eq('cluster', cluster);
  if (!rows?.length) return { data: null, error: null };
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
  return supabase.from('esg_social_data')
    .upsert({ period_id: periodId, ...data, updated_at: new Date().toISOString() },
             { onConflict: 'period_id' });
}

export async function upsertGovernanceData(periodId, data) {
  return supabase.from('esg_governance_data')
    .upsert({ period_id: periodId, ...data, updated_at: new Date().toISOString() },
             { onConflict: 'period_id' });
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
