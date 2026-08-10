CREATE TYPE "public"."consent_kind" AS ENUM('marketing', 'photography', 'data_processing', 'terms_and_conditions');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('photo_id', 'medical_certificate', 'signed_consent', 'other');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."import_row_status" AS ENUM('ok', 'error', 'duplicate', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'inactive', 'suspended', 'frozen');--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" "consent_kind" NOT NULL,
	"granted" boolean NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "guest_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"guest_name" text NOT NULL,
	"guest_phone" text,
	"host_member_id" uuid,
	"valid_on" date NOT NULL,
	"used_at" timestamp with time zone,
	"issued_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"relationship" text DEFAULT 'other' NOT NULL,
	CONSTRAINT "household_members_household_id_member_id_pk" PRIMARY KEY("household_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"payer_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_key" text NOT NULL,
	"mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"total_rows" integer,
	"ok_rows" integer,
	"error_rows" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"import_job_id" uuid NOT NULL,
	"row_no" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"status" "import_row_status" NOT NULL,
	"errors" jsonb,
	"entity_id" uuid
);
--> statement-breakpoint
CREATE TABLE "member_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"label" text,
	"file_key" text NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"expires_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_seq" integer NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"date_of_birth" date,
	"gender" "gender",
	"nic" text,
	"address" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"photo_key" text,
	"nfc_uid" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"medical_note" text,
	"joined_at" date DEFAULT CURRENT_DATE NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_passes" ADD CONSTRAINT "guest_passes_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_passes" ADD CONSTRAINT "guest_passes_host_member_id_members_id_fk" FOREIGN KEY ("host_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_passes" ADD CONSTRAINT "guest_passes_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_payer_member_id_members_id_fk" FOREIGN KEY ("payer_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consents_gym_id_idx" ON "consents" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "consents_member_id_idx" ON "consents" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "guest_passes_gym_id_valid_on_idx" ON "guest_passes" USING btree ("gym_id","valid_on");--> statement-breakpoint
CREATE INDEX "guest_passes_host_member_id_idx" ON "guest_passes" USING btree ("host_member_id");--> statement-breakpoint
CREATE INDEX "household_members_member_id_idx" ON "household_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "households_gym_id_idx" ON "households" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "import_jobs_gym_id_idx" ON "import_jobs" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "import_rows_job_id_idx" ON "import_rows" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "import_rows_gym_id_idx" ON "import_rows" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "member_documents_gym_id_idx" ON "member_documents" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "member_documents_member_id_idx" ON "member_documents" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_gym_seq_key" ON "members" USING btree ("gym_id","member_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "members_nfc_uid_key" ON "members" USING btree ("nfc_uid");--> statement-breakpoint
CREATE INDEX "members_gym_id_idx" ON "members" USING btree ("gym_id");--> statement-breakpoint
CREATE INDEX "members_gym_status_idx" ON "members" USING btree ("gym_id","status");--> statement-breakpoint
CREATE INDEX "members_name_idx" ON "members" USING btree ("gym_id","last_name","first_name");