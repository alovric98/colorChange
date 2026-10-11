import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AiMatchAnalysis, MatchFacts, SourceLink } from "@/lib/analysis/types";

/** Status analize za ligu + dan. */
export type AnalysisStatus = "queued" | "working" | "done" | "error" | "empty";
/** Status pojedine utakmice unutar analize. */
export type MatchStatus = "pending" | "working" | "done" | "error";

export const analyses = pgTable(
  "analyses",
  {
    id: serial("id").primaryKey(),
    leagueKey: text("league_key").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD (Europe/Zagreb)
    status: text("status").$type<AnalysisStatus>().notNull().default("queued"),
    error: text("error"),
    matchCount: integer("match_count"),
    /** Kod osvježavanja zaobiđi keš za izostanke i koeficijente. */
    forceFresh: boolean("force_fresh").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("analyses_league_date").on(t.leagueKey, t.date)],
);

export const matchAnalyses = pgTable(
  "match_analyses",
  {
    id: serial("id").primaryKey(),
    analysisId: integer("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    leagueKey: text("league_key").notNull(),
    fixtureId: integer("fixture_id").notNull(),
    kickoff: timestamp("kickoff", { withTimezone: true }).notNull(),
    status: text("status").$type<MatchStatus>().notNull().default("pending"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    facts: jsonb("facts").$type<MatchFacts>().notNull(),
    ai: jsonb("ai").$type<AiMatchAnalysis>(),
    sources: jsonb("sources").$type<SourceLink[]>(),
    error: text("error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Stvarni ishod (upisuje cron)
    fixtureStatus: text("fixture_status"),
    homeGoals: integer("home_goals"),
    awayGoals: integer("away_goals"),
    mainHit: boolean("main_hit"),
    extraHit: boolean("extra_hit"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("match_analyses_analysis_fixture").on(t.analysisId, t.fixtureId),
    index("match_analyses_settle").on(t.settledAt, t.kickoff),
  ],
);

export const apiCache = pgTable("api_cache", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
