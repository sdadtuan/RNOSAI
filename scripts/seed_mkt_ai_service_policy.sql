-- 3 slug đang VPS = pilot; các slug default catalog = off (trừ 3 cái trên)
INSERT INTO mkt_ai_service_policy (service_slug, rollout, enabled)
VALUES
  ('meta-lead-gen', 'pilot', TRUE),
  ('bds-lead-gen', 'pilot', TRUE),
  ('seo-retainer', 'pilot', TRUE),
  ('quang-cao-facebook', 'pilot', TRUE),
  ('quang-cao-google', 'off', TRUE),
  ('tiep-thi-noi-dung', 'off', TRUE),
  ('lead-gen', 'off', TRUE),
  ('thue-tai-khoan-quang-cao', 'off', TRUE),
  ('dich-vu-seo-tong-the', 'off', TRUE),
  ('dich-vu-seo-local', 'off', TRUE),
  ('dich-vu-seo-audit', 'off', TRUE),
  ('dich-vu-aeo', 'off', TRUE),
  ('email-sms-zalo-marketing', 'off', TRUE)
ON CONFLICT (service_slug) DO NOTHING;
