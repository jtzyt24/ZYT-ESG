# ZYT.ESG — Personal Data Inventory Map

**Generated from:** `js/zyt-core/schema.js`
**DPE reference:** Step 2.1 — Establish an Asset Inventory for your personal/business-critical data
**Last reviewed:** 2026-06-14

This document satisfies the Data Inventory Map (DIM) requirement of the
Data Protection Essentials checklist (Step 2.1). It is generated from the
canonical data shapes in `schema.js`, so it stays accurate as the schema
changes — **update this file whenever a field is added to schema.js with
classification `personal`.**

---

## Summary

ZYT.ESG's personal-data footprint is intentionally minimal. Across the
entire data model, only **two fields** constitute personal data:

| Field | Location | Why it's personal data |
|---|---|---|
| `responsiblePerson` | `profiles.responsible_person_name` | Name of the individual designated as the company's ESG point of contact |
| `signatoryName` | `reports.signatory_name` | Name of the individual who signs the published sustainability report |

Everything else collected by ZYT.ESG (workforce counts, training hours,
emissions data, governance policies) is **aggregate statistical data** —
counts and percentages that describe the organisation, not identifiable
individuals.

---

## 1. Personal Data Inventory

| # | Department | Data Subject | Type of Data | Personal Data Item | Consent Collection | Data Classification | Collection Purpose | Data Owner | Collection Source | Storage |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | N/A (single-user SME tool) | ESG responsible person (employee/owner of the SME customer) | Personal | Name, role title | Provided voluntarily by the user during company profile setup (S-06) | Internal — low sensitivity | Identify the named contact for ESG governance, as required by SGX Core ESG Metrics governance disclosures | The SME (data controller); ZYT.ESG (processor) | Direct entry via S-06-company-profile.html | Supabase Postgres `profiles` table, RLS-scoped to the user's own `auth.uid()` |
| 2 | N/A | Report signatory (employee/owner of the SME customer) | Personal | Name, role title | Provided voluntarily during report finalisation (S-23 / S-25) | Internal — intentionally published | Attribution on the published Sustainability Report, per standard reporting practice | The SME (data controller); ZYT.ESG (processor) | Direct entry via S-23-sustainability-context.html | Supabase Postgres `reports` table, RLS-scoped |

### Usage, Disclosure, Retention (per DIM Annex format)

| Field | Users of Data | Access by Departments | External Transfer | Retention Period | Disposal Method |
|---|---|---|---|---|---|
| `responsiblePerson` | The SME user themselves; ZYT.ESG (as processor, for support purposes only) | N/A — single-tenant SaaS, RLS-enforced | None. Appears in the user's own report PDF, which the user downloads and distributes themselves. | Retained for the lifetime of the user's account, or until the user deletes their profile. | User-initiated account deletion cascades via `on delete cascade` in `profiles` table. |
| `signatoryName` | Same as above | Same as above | Same as above — this is the *intended* purpose of the field (public attribution on a report the user chooses to share). | Same as above. | Same as above. |

---

## 2. Authentication Data (handled by Supabase, not ZYT.ESG's own schema)

| Item | Notes |
|---|---|
| Email address | Collected at signup (`S-03-signup.html`), stored and managed entirely by Supabase Auth (`auth.users` table). ZYT.ESG's own tables never duplicate this — `profiles.id` is a foreign key reference only. |
| Password | Never stored by ZYT.ESG. Handled by Supabase Auth (hashed, per Supabase's own security practices). |

This is a deliberate architectural choice: by not duplicating auth data
into application tables, ZYT.ESG's own personal-data inventory stays
limited to the two fields above.

---

## 3. Aggregate / Non-Personal Data (for completeness — NOT part of the DIM)

The following data categories are collected but are **explicitly not
personal data** because they are reported as organisation-level counts,
never as individual records:

- **Workforce demographics** (`social_data` table): total headcount,
  gender split, age bands, training hours — all integers/percentages
  describing the organisation as a whole. No employee names, IDs, or
  individual records are ever collected.
- **Governance data** (`governance_data` table): management team
  composition (counts only), certifications, policy flags.
- **Emissions data** (`emissions_data` table): fuel/energy/waste
  quantities and calculated emissions — business operational data, not
  personal data.

If a future feature introduces individual-level records (e.g. a named
employee training log, or an incident report naming individuals), it
**must** be added to Section 1 of this document before release, with
its own consent/retention/disposal entry.

---

## 4. IT Asset Inventory (DPE Step 2.2 — summary)

| Asset | Type | Classification | Location | Notes |
|---|---|---|---|---|
| ZYT.ESG application | Software (hardware: none — fully managed) | Internal | Netlify (hosting), Supabase (database + auth) | Both vendors are SOC2-compliant managed services |
| Supabase project (ESG.ZYT) | Database / Auth service | Confidential | Supabase Cloud, `ap-southeast-1` (Singapore) recommended | RLS enabled on every table — see `database.sql` |
| Source code repository | Software | Internal | GitHub (private repo recommended) | Contains no secrets — Supabase anon key is public-by-design; service role key (if ever used) must never be committed |

---

## 5. Account Inventory (DPE Step 2.3 — summary)

Single-tenant SaaS: each SME user has exactly one `auth.users` account
and one `profiles` row, enforced by RLS (`auth.uid() = id`). There are
no shared admin accounts, no service accounts, and no third-party
integration accounts at this stage.

| Role | Access scope |
|---|---|
| SME user (self-registered) | Own data only, via RLS |
| ZYT.ESG operator (Supabase project owner) | Full database access via Supabase dashboard — should be limited to the founder's account, with 2FA enabled (DPE Step 6.5) |

---

*This document should be reviewed whenever `schema.js` changes. If you
add a field tagged `personal`, add a corresponding row to Section 1.*
