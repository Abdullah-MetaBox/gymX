ALTER TABLE "users" ADD COLUMN "clerk_user_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users" USING btree ("clerk_user_id");