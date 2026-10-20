CREATE TYPE "public"."artifact_candidate_status" AS ENUM('READY', 'SELECTED', 'DISCARDED');--> statement-breakpoint
CREATE TYPE "public"."artifact_request_changeset_role" AS ENUM('TARGET', 'SUPPORTING');--> statement-breakpoint
CREATE TABLE "artifact_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_request_id" uuid NOT NULL,
	"type" "artifact_type" NOT NULL,
	"ordinal" integer NOT NULL,
	"angle" text NOT NULL,
	"content" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"status" "artifact_candidate_status" DEFAULT 'READY' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_candidates_request_type_ordinal_unique" UNIQUE("artifact_request_id","type","ordinal"),
	CONSTRAINT "artifact_candidates_ordinal_check" CHECK ("artifact_candidates"."ordinal" between 0 and 1)
);
--> statement-breakpoint
CREATE TABLE "artifact_generation_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_request_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "artifact_generation_outbox_artifact_request_id_unique" UNIQUE("artifact_request_id")
);
--> statement-breakpoint
ALTER TABLE "artifact_request_changeset" ADD COLUMN "role" "artifact_request_changeset_role" DEFAULT 'TARGET' NOT NULL;--> statement-breakpoint
ALTER TABLE "artifact_requests" ADD COLUMN "scope" jsonb;--> statement-breakpoint
ALTER TABLE "artifact_candidates" ADD CONSTRAINT "artifact_candidates_artifact_request_id_artifact_requests_id_fk" FOREIGN KEY ("artifact_request_id") REFERENCES "public"."artifact_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_generation_outbox" ADD CONSTRAINT "artifact_generation_outbox_artifact_request_id_artifact_requests_id_fk" FOREIGN KEY ("artifact_request_id") REFERENCES "public"."artifact_requests"("id") ON DELETE no action ON UPDATE no action;