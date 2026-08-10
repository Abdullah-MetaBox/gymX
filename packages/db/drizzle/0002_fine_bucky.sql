CREATE TYPE "public"."billing_interval" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."plan_area" AS ENUM('gym', 'pool', 'classes');--> statement-breakpoint
CREATE TYPE "public"."plan_category" AS ENUM('solo', 'couple', 'family', 'group', 'student', 'lunch', 'full');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('contract', 'pass');--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('flat', 'flat_by_size', 'per_head_by_size');--> statement-breakpoint
CREATE TABLE "plan_access_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"area" "plan_area" NOT NULL,
	"weekdays" integer[],
	"start_time" text,
	"end_time" text
);
--> statement-breakpoint
CREATE TABLE "plan_price_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"size_from" integer NOT NULL,
	"size_to" integer,
	"price_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"type" "plan_type" NOT NULL,
	"category" "plan_category" NOT NULL,
	"billing_interval" "billing_interval",
	"base_price_cents" bigint NOT NULL,
	"vat_inclusive" boolean DEFAULT false NOT NULL,
	"joining_fee_cents" bigint DEFAULT 0 NOT NULL,
	"min_term_months" integer DEFAULT 0 NOT NULL,
	"pass_duration_days" integer,
	"pricing_model" "pricing_model" DEFAULT 'flat' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_access_rules" ADD CONSTRAINT "plan_access_rules_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_access_rules" ADD CONSTRAINT "plan_access_rules_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price_tiers" ADD CONSTRAINT "plan_price_tiers_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_price_tiers" ADD CONSTRAINT "plan_price_tiers_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_access_rules_plan_id_idx" ON "plan_access_rules" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_access_rules_gym_id_idx" ON "plan_access_rules" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "plan_price_tiers_plan_id_idx" ON "plan_price_tiers" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "plan_price_tiers_gym_id_idx" ON "plan_price_tiers" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "plans_gym_id_idx" ON "plans" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "plans_gym_active_idx" ON "plans" USING btree ("gym_id","active");