CREATE OR REPLACE FUNCTION jw_retention_clock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  account_closed timestamptz;
  guard_active boolean := false;
BEGIN
  IF TG_TABLE_NAME='listings' THEN
    IF NEW.status IN ('sold','expired','removed') THEN
      IF TG_OP='INSERT' THEN NEW.retention_inactive_at=COALESCE(NEW.retention_inactive_at,NOW());
      ELSIF OLD.status NOT IN ('sold','expired','removed') THEN NEW.retention_inactive_at=NOW();
      END IF;
    ELSE NEW.retention_inactive_at=NULL;
    END IF;

    IF TG_OP='INSERT' THEN
      guard_active := NEW.status='active';
    ELSE
      -- Counter updates already hold the listing row; locking its seller here
      -- reverses account closure's seller-to-listing order.
      guard_active := NEW.status='active' AND
        (OLD.status IS DISTINCT FROM NEW.status OR OLD.seller_id IS DISTINCT FROM NEW.seller_id);
    END IF;
    IF guard_active THEN
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
