-- Allow TikTok Ads advertiser mapping in B2B Nhận lead (crm_b2b_project_channel_accounts).
ALTER TABLE crm_b2b_project_channel_accounts
  DROP CONSTRAINT IF EXISTS crm_b2b_project_channel_accounts_channel_type_check;

ALTER TABLE crm_b2b_project_channel_accounts
  ADD CONSTRAINT crm_b2b_project_channel_accounts_channel_type_check
  CHECK (channel_type IN ('zalo', 'webform', 'api', 'tiktok'));
