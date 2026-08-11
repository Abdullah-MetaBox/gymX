CREATE TYPE "public"."bank_import_status" AS ENUM('pending', 'matched', 'review_needed', 'reconciled');--> statement-breakpoint
CREATE TYPE "public"."transaction_match_status" AS ENUM('matched', 'unmatched', 'review_needed', 'rejected');--> statement-breakpoint
CREATE TABLE "bank_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"statement_start_date" date NOT NULL,
	"statement_end_date" date NOT NULL,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"matched_transactions" integer DEFAULT 0 NOT NULL,
	"unmatched_transactions" integer DEFAULT 0 NOT NULL,
	"status" "bank_import_status" DEFAULT 'pending' NOT NULL,
	"total_amount_cents" bigint NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"bank_import_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"running_balance_cents" bigint,
	"reference_extracted" text,
	"match_status" "transaction_match_status" DEFAULT 'unmatched' NOT NULL,
	"matched_payment_id" uuid,
	"confidence_score" integer DEFAULT 0,
	"matched_by" uuid,
	"matched_at" timestamp with time zone,
	"match_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_imports" ADD CONSTRAINT "bank_imports_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_imports" ADD CONSTRAINT "bank_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_import_id_bank_imports_id_fk" FOREIGN KEY ("bank_import_id") REFERENCES "public"."bank_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matched_by_users_id_fk" FOREIGN KEY ("matched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_imports_gym_idx" ON "bank_imports" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "bank_imports_status_idx" ON "bank_imports" USING btree ("gym_id","status");--> statement-breakpoint
CREATE INDEX "bank_imports_date_idx" ON "bank_imports" USING btree ("statement_start_date","statement_end_date");--> statement-breakpoint
CREATE INDEX "bank_transactions_gym_idx" ON "bank_transactions" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_reference_idx" ON "bank_transactions" USING btree ("reference_extracted");--> statement-breakpoint
CREATE INDEX "bank_transactions_match_status_idx" ON "bank_transactions" USING btree ("match_status");--> statement-breakpoint
CREATE INDEX "bank_transactions_date_idx" ON "bank_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "bank_transactions_import_idx" ON "bank_transactions" USING btree ("bank_import_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_amount_idx" ON "bank_transactions" USING btree ("amount_cents");--> statement-breakpoint
ALTER TABLE "public"."members" ALTER COLUMN "gender" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."gender";--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
ALTER TABLE "public"."members" ALTER COLUMN "gender" SET DATA TYPE "public"."gender" USING "gender"::"public"."gender";