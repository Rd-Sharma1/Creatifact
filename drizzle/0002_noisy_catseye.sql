CREATE TABLE "artifact_request_type" (
	"artifact_request_id" uuid NOT NULL,
	"type" "artifact_type" NOT NULL,
	CONSTRAINT "artifact_request_type_artifact_request_id_type_pk" PRIMARY KEY("artifact_request_id","type")
);
--> statement-breakpoint
ALTER TABLE "artifact_request_type" ADD CONSTRAINT "artifact_request_type_artifact_request_id_artifact_requests_id_fk" FOREIGN KEY ("artifact_request_id") REFERENCES "public"."artifact_requests"("id") ON DELETE no action ON UPDATE no action;