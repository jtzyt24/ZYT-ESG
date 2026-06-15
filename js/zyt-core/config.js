// ============================================================
// ZYT.ESG — js/zyt-core/config.js
// ============================================================
// Single source of truth for: industry labels & relevance,
// canonical screen navigation, and framework (UNGC/TR149/SGX)
// conditional-rendering rules.
//
// Screens MUST import from here rather than declaring their
// own copies. If a screen needs a new industry, framework, or
// route, it is added HERE — once — not in the screen file.
// ============================================================

// ── INDUSTRIES ──────────────────────────────────────────────
// Canonical industry codes. Must match `profiles.industry` in database.sql
// and the `data-ind` values in S-06-company-profile.html.

export const INDUSTRY_LABELS = {
  fnb:           'Food & Beverage',
  retail:        'Retail',
  logistics:     'Logistics & Transport',
  manufacturing: 'Manufacturing',
  construction:  'Construction',
  ict:           'ICT & Professional Services',
  cleaning:      'Cleaning & Facility Services',
  healthcare:    'Healthcare & Social Services',
  hospitality:   'Hospitality & Events',
  other:         'General Business',
};

// Which of the 8 emissions clusters (see CLUSTERS below) are
// highlighted as "most relevant" for each industry. All clusters
// remain visible — this only affects highlighting/ordering.
export const INDUSTRY_RELEVANCE = {
  fnb:           ['power', 'cooling', 'cooking', 'waste'],
  retail:        ['power', 'waste', 'people', 'digital'],
  logistics:     ['transport', 'power', 'cooling', 'people'],
  manufacturing: ['power', 'cooling', 'cooking', 'waste', 'procurement'],
  construction:  ['transport', 'power', 'waste', 'procurement'],
  ict:           ['power', 'digital', 'people', 'procurement'],
  cleaning:      ['transport', 'people', 'procurement', 'power'],
  healthcare:    ['power', 'cooling', 'waste', 'procurement'],
  hospitality:   ['power', 'cooling', 'cooking', 'waste', 'people'],
  other:         ['power', 'transport', 'waste', 'people'],
};

// ── EMISSIONS CLUSTERS ───────────────────────────────────────
// Canonical cluster definitions. `id` maps to emissions_data.cluster
// in database.sql and to the localStorage keys in schema.js.
// `screen` maps to NAV_MAP below.

export const CLUSTERS = [
  { id: 'power',       icon: '⚡', name: 'Power & energy',           role: 'Owner / facilities manager',       scopes: ['S2', 'S1'], screen: 'S-10' },
  { id: 'transport',   icon: '🚚', name: 'Transport & fleet',         role: 'Logistics / operations manager',   scopes: ['S1', 'S3'], screen: 'S-11' },
  { id: 'cooling',     icon: '❄',  name: 'Cooling & refrigeration',   role: 'Facilities manager',               scopes: ['S1'],       screen: 'S-12' },
  { id: 'cooking',     icon: '🔥', name: 'Cooking & process heat',    role: 'Kitchen supervisor',                scopes: ['S1'],       screen: 'S-13' },
  { id: 'waste',       icon: '♻',  name: 'Waste & water',             role: 'Operations / kitchen',              scopes: ['S3'],       screen: 'S-14' },
  { id: 'people',      icon: '🚶', name: 'People & commuting',        role: 'HR manager',                        scopes: ['S3'],       screen: 'S-15' },
  { id: 'digital',     icon: '☁',  name: 'Digital & IT',              role: 'IT manager / office manager',       scopes: ['S3'],       screen: 'S-16' },
  { id: 'procurement', icon: '📦', name: 'Procurement & supply chain',role: 'Purchasing / admin',                scopes: ['S3'],       screen: 'S-17' },
];

// ── NAVIGATION MAP ───────────────────────────────────────────
// Canonical screen routing. Replaces the `screenMap` objects
// previously duplicated in S-09 and S-18.

export const NAV_MAP = {
  // Auth / onboarding
  'S-02': '/S-02-intent-selector.html',
  'S-03': '/S-03-signup.html',
  'S-04': '/S-04-check-email.html',
  'S-05': '/S-05-login.html',
  'S-06': '/S-06-company-profile.html',

  // Data entry hub + clusters
  'S-09': '/S-09-data-entry-hub.html',
  'S-10': '/S-10-power-energy-v3.html',
  'S-11': '/S-11-transport-fleet.html',
  'S-12': '/S-12-cooling-refrigeration.html',
  'S-13': '/S-13-cooking-process-heat.html',
  'S-14': '/S-14-waste-water.html',
  'S-15': '/S-15-people-commuting.html',
  'S-16': '/S-16-digital-it.html',
  'S-17': '/S-17-procurement.html',
  'S-18': '/S-18-review-confirm.html',

  // Social & Governance
  'S-31': '/S-31-32-social.html',
  'S-32': '/S-31-32-social.html',
  'S-33': '/S-33-governance.html',

  // Results, targets, context, report
  'S-19': '/S-19-carbon-overview.html',
  'S-21': '/S-21-target-setting.html',
  'S-23': '/S-23-sustainability-context.html',
  'S-24': '/S-24-report-preview.html',
  'S-25': '/S-25-generate.html',
};

/** Navigate to a screen by its canonical S-NN code. No-op + console.warn if unknown. */
export function goTo(screenCode) {
  const url = NAV_MAP[screenCode];
  if (!url) {
    console.warn(`[zyt-core] Unknown screen code: ${screenCode}`);
    return;
  }
  window.location.href = url;
}

// ── FRAMEWORKS ───────────────────────────────────────────────
// Conditional-rendering rules for reporting frameworks.
// A framework is "active" if the corresponding localStorage
// flag (set in S-02 / S-06) is truthy.
//
// Screens use `isFrameworkActive(code)` and/or the
// `data-frameworks="ungc tr149"` HTML attribute pattern
// (any one of the listed frameworks active => element shown).

export const FRAMEWORKS = {
  sgx: {
    label: 'SGX Core ESG Metrics',
    storageFlag: null, // always active — baseline framework
    alwaysActive: true,
  },
  ghg: {
    label: 'GHG Protocol',
    storageFlag: null,
    alwaysActive: true,
  },
  ungc: {
    label: 'UNGC Communication on Progress',
    storageFlag: 'zyt_intent_ungc', // set in S-02
  },
  tr149: {
    label: 'TR 149:2026 (Enterprise Singapore)',
    storageFlag: 'zyt_intent_tr149', // not yet set anywhere — add to S-02 when TR149 fields exist
  },
  pcr: {
    label: 'Product Carbon Reporting',
    storageFlag: 'zyt_intent_pcr', // set in S-02
  },
};

/** Returns true if the given framework code is currently active for this user. */
export function isFrameworkActive(code) {
  const fw = FRAMEWORKS[code];
  if (!fw) {
    console.warn(`[zyt-core] Unknown framework code: ${code}`);
    return false;
  }
  if (fw.alwaysActive) return true;
  if (!fw.storageFlag) return false;
  return localStorage.getItem(fw.storageFlag) === 'true';
}

/**
 * Applies data-frameworks="ungc tr149" conditional visibility to the document.
 * Any element with this attribute is shown if AT LEAST ONE listed framework
 * is active, hidden otherwise. Call once on page load.
 *
 * Usage in HTML:
 *   <div data-frameworks="ungc">...UNGC-specific content...</div>
 *   <div data-frameworks="tr149 gri">...shown for TR149 OR GRI...</div>
 */
export function applyFrameworkVisibility(root = document) {
  root.querySelectorAll('[data-frameworks]').forEach(el => {
    const codes = el.getAttribute('data-frameworks').trim().split(/\s+/);
    const show = codes.some(code => isFrameworkActive(code));
    el.style.display = show ? '' : 'none';
  });
}

/** Returns the list of currently-active framework labels, for display in reports. */
export function getActiveFrameworkLabels() {
  return Object.values(FRAMEWORKS)
    .filter(fw => fw.alwaysActive || (fw.storageFlag && localStorage.getItem(fw.storageFlag) === 'true'))
    .map(fw => fw.label);
}
