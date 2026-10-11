CREATE TABLE "analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"league_key" text NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"match_count" integer,
	"force_fresh" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "api_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"analysis_id" integer NOT NULL,
	"league_key" text NOT NULL,
	"fixture_id" integer NOT NULL,
	"kickoff" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"claimed_at" timestamp with time zone,
	"facts" jsonb NOT NULL,
	"ai" jsonb,
	"sources" jsonb,
	"error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fixture_status" text,
	"home_goals" integer,
	"away_goals" integer,
	"main_hit" boolean,
	"extra_hit" boolean,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "match_analyses" ADD CONSTRAINT "match_analyses_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analyses_league_date" ON "analyses" USING btree ("league_key","date");--> statement-breakpoint
CREATE UNIQUE INDEX "match_analyses_analysis_fixture" ON "match_analyses" USING btree ("analysis_id","fixture_id");--> statement-breakpoint
CREATE INDEX "match_analyses_settle" ON "match_analyses" USING btree ("settled_at","kickoff");