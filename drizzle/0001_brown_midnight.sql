CREATE TYPE "public"."artifact_request_status" AS ENUM('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('X_POST', 'LINKEDIN_POST');--> statement-breakpoint
CREATE TABLE "artifact_request_changeset" (
	"artifact_request_id" uuid NOT NULL,
	"change_set_id" uuid NOT NULL,
	CONSTRAINT "artifact_request_changeset_artifact_request_id_change_set_id_pk" PRIMARY KEY("artifact_request_id","change_set_id")
);
--> statement-breakpoint
CREATE TABLE "artifact_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"instructions" text,
	"status" "artifact_request_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_request_id" uuid NOT NULL,
	"type" "artifact_type" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_repo_id" bigint NOT NULL,
	"owner" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repository_github_repo_id_unique" UNIQUE("github_repo_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_repo" (
	"userId" uuid NOT NULL,
	"repository_id" uuid NOT NULL,
	CONSTRAINT "user_repo_userId_repository_id_pk" PRIMARY KEY("userId","repository_id")
);
--> statement-breakpoint
ALTER TABLE "change_sets" DROP CONSTRAINT "change_sets_basehead_unique";--> statement-breakpoint
ALTER TABLE "change_sets" ADD COLUMN "repository_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "change_sets" ADD COLUMN "base" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "change_sets" ADD COLUMN "head" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "artifact_request_changeset" ADD CONSTRAINT "artifact_request_changeset_artifact_request_id_artifact_requests_id_fk" FOREIGN KEY ("artifact_request_id") REFERENCES "public"."artifact_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_request_changeset" ADD CONSTRAINT "artifact_request_changeset_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."change_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_requests" ADD CONSTRAINT "artifact_requests_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_artifact_request_id_artifact_requests_id_fk" FOREIGN KEY ("artifact_request_id") REFERENCES "public"."artifact_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_repo" ADD CONSTRAINT "user_repo_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_repo" ADD CONSTRAINT "user_repo_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_sets" DROP COLUMN "repository";--> statement-breakpoint
ALTER TABLE "change_sets" ADD CONSTRAINT "change_sets_repository_id_basehead_unique" UNIQUE("repository_id","basehead");