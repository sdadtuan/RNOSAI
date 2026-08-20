CREATE TABLE IF NOT EXISTS cmkt_video_licenses (
  id              bigserial PRIMARY KEY,
  lifecycle_id    bigint NOT NULL,
  item_id         bigint NOT NULL,
  asset_kind      text NOT NULL CHECK (asset_kind IN ('stock_clip', 'music_bed', 'tts', 'logo', 'upload')),
  provider        text NOT NULL,
  provider_id     text,
  license_name    text NOT NULL,
  source_url      text,
  local_storage_key text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cmkt_video_licenses_item_idx ON cmkt_video_licenses (item_id);
