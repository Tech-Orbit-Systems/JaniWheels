CREATE TABLE "retention_identity" (
	"id" integer PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "retention_receipts_event_uq" ON "retention_receipts" USING btree ("resource","resource_id","action","occurred_at");
--> statement-breakpoint
INSERT INTO retention_identity(id,instance_id) VALUES(1,gen_random_uuid()::text);
--> statement-breakpoint
UPDATE listings SET retention_inactive_at=COALESCE(sold_at,seller_deleted_at,updated_at) WHERE status IN ('sold','expired','removed');
--> statement-breakpoint
UPDATE inspections SET closed_at=updated_at WHERE status IN ('completed','cancelled');
--> statement-breakpoint
UPDATE sell_assistance_requests SET closed_at=updated_at WHERE status IN ('sold','cancelled');
--> statement-breakpoint
CREATE FUNCTION jw_retention_clock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_closed timestamptz;
BEGIN
  IF TG_TABLE_NAME='listings' THEN
    IF NEW.status IN ('sold','expired','removed') THEN
      IF TG_OP='INSERT' THEN NEW.retention_inactive_at=COALESCE(NEW.retention_inactive_at,NOW());
      ELSIF OLD.status NOT IN ('sold','expired','removed') THEN NEW.retention_inactive_at=NOW();
      END IF;
    ELSE NEW.retention_inactive_at=NULL;
    END IF;
    IF NEW.status='active' THEN
      SELECT closed_at INTO account_closed FROM users WHERE id=NEW.seller_id FOR SHARE;
      IF account_closed IS NOT NULL THEN RAISE EXCEPTION 'Closed account cannot publish listings'; END IF;
    END IF;
  ELSE
    IF NEW.status IN ('completed','cancelled','sold') THEN
      IF TG_OP='INSERT' THEN NEW.closed_at=COALESCE(NEW.closed_at,NOW());
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN NEW.closed_at=NOW();
      END IF;
    ELSE NEW.closed_at=NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER listings_retention_clock BEFORE INSERT OR UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION jw_retention_clock();
--> statement-breakpoint
CREATE TRIGGER inspections_retention_clock BEFORE INSERT OR UPDATE ON inspections FOR EACH ROW EXECUTE FUNCTION jw_retention_clock();
--> statement-breakpoint
CREATE TRIGGER assistance_retention_clock BEFORE INSERT OR UPDATE ON sell_assistance_requests FOR EACH ROW EXECUTE FUNCTION jw_retention_clock();
--> statement-breakpoint
CREATE FUNCTION jw_closed_session_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account users%ROWTYPE;
BEGIN
  SELECT * INTO account FROM users WHERE id=NEW.user_id FOR SHARE;
  IF account.closed_at IS NOT NULL AND (NOT NEW.recovery_only OR account.closed_at<=NOW()-INTERVAL '30 days' OR account.anonymized_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Closed account permits recovery sessions only during its recovery period';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER closed_session_guard BEFORE INSERT OR UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION jw_closed_session_guard();
--> statement-breakpoint
CREATE FUNCTION jw_closed_profile_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.closed_at IS NOT NULL AND NEW.closed_at IS NOT NULL AND NEW.anonymized_at IS NULL AND
    (NEW.name IS DISTINCT FROM OLD.name OR NEW.phone IS DISTINCT FROM OLD.phone OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url OR
    NEW.email IS DISTINCT FROM OLD.email OR (NEW.password_hash IS DISTINCT FROM OLD.password_hash AND NEW.password_hash IS NOT NULL)) THEN
    RAISE EXCEPTION 'Closed account cannot change its profile';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER closed_profile_guard BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION jw_closed_profile_guard();
