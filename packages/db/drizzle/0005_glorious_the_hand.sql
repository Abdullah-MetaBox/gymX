CREATE TYPE "public"."access_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."access_method" AS ENUM('nfc', 'qr', 'manual', 'api');--> statement-breakpoint
CREATE TYPE "public"."access_reason" AS ENUM('granted', 'member_inactive', 'no_active_subscription', 'outside_access_window', 'payment_overdue', 'module_hook_deny');--> statement-breakpoint
CREATE TYPE "public"."access_result" AS ENUM('granted', 'denied');--> statement-breakpoint
CREATE TABLE "access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"entered_at" timestamp with time zone NOT NULL,
	"direction" "access_direction" NOT NULL,
	"method" "access_method" NOT NULL,
	"area" text NOT NULL,
	"result" "access_result" NOT NULL,
	"reason_code" "access_reason" NOT NULL,
	"overridden_by" uuid,
	"override_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"entered_at" timestamp with time zone NOT NULL,
	"exited_at" timestamp with time zone,
	"dwell_minutes" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_reversal_of_payments_id_fk";
--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_events_gym_idx" ON "access_events" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "access_events_member_idx" ON "access_events" USING btree ("gym_id","member_id");--> statement-breakpoint
CREATE INDEX "access_events_entered_idx" ON "access_events" USING btree ("gym_id","entered_at");--> statement-breakpoint
CREATE INDEX "access_events_result_idx" ON "access_events" USING btree ("gym_id","result");--> statement-breakpoint
CREATE INDEX "visits_gym_idx" ON "visits" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "visits_member_idx" ON "visits" USING btree ("gym_id","member_id");--> statement-breakpoint
CREATE INDEX "visits_entered_idx" ON "visits" USING btree ("gym_id","entered_at");