CREATE TABLE "change_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository" varchar(100) NOT NULL,
	"basehead" varchar(100) NOT NULL,
	"changes" jsonb NOT NULL,
	"commits" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "change_sets_basehead_unique" UNIQUE("basehead")
);
