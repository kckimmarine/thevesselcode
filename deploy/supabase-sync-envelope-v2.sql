-- SYNC-ENVELOPE-V2 — optional audit columns on sync_package_ingest
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE sync_package_ingest
  ADD COLUMN IF NOT EXISTS sync_id TEXT;

ALTER TABLE sync_package_ingest
  ADD COLUMN IF NOT EXISTS verification_status TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sync_package_ingest_sync_id_uidx
  ON sync_package_ingest (sync_id)
  WHERE sync_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sync_package_ingest_verification_idx
  ON sync_package_ingest (verification_status, ingested_at DESC);

COMMENT ON COLUMN sync_package_ingest.sync_id IS 'Envelope v2 sync_id for idempotent ingest';
COMMENT ON COLUMN sync_package_ingest.verification_status IS 'VERIFIED | REJECTED | DUPLICATE | LEGACY | SKIPPED';
