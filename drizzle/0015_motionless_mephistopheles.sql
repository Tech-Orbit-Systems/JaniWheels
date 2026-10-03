CREATE INDEX "listings_recent_idx" ON "listings" USING btree ("vertical","status","published_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);
