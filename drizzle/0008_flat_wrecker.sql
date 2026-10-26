CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"correlation_id" uuid,
	"artifact_request_id" uuid,
	"workflow_run_id" varchar(200),
	"operation" varchar(32) NOT NULL,
	"model" varchar(200),
	"prompt_version" varchar(100) NOT NULL,
	"started_at" timestamp NOT NULL,
	"duration_ms" integer NOT NULL,
	"outcome" varchar(16) NOT NULL,
	"failure_category" varchar(32),
	"retry_attempt" integer,
	"validation_failure_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"cost" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifact_generation_outbox" ADD COLUMN "correlation_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_artifact_request_id_artifact_requests_id_fk" FOREIGN KEY ("artifact_request_id") REFERENCES "public"."artifact_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_runs_artifact_request_created_at_idx" ON "ai_runs" USING btree ("artifact_request_id","created_at");