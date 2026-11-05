-- Lead party for Quotation OS (QT-LEAD-PARTY-20260909)
-- Draft SoT on crm_leads; snapshot on send lives in crm_quote_versions.party_json.

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logo_asset_id TEXT;

UPDATE crm_leads
   SET company_name = TRIM(COALESCE(
         NULLIF(company_name, ''),
         NULLIF(meta_json->>'company_name', ''),
         NULLIF(meta_json->>'company', ''),
         NULLIF(meta_json->'lead_identity'->>'company_name', ''),
         NULLIF(meta_json->>'intake_company_name', ''),
         ''
       ))
 WHERE TRIM(COALESCE(company_name, '')) = '';

ALTER TABLE crm_quote_versions
  ADD COLUMN IF NOT EXISTS party_json JSONB NOT NULL DEFAULT '{}';
