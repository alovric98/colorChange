/**
 * Provjera ID-eva liga preko API-Football /leagues.
 * Pokretanje: npm run leagues:check (čita API_FOOTBALL_KEY iz .env.local)
 * Troši jedan API poziv po ligi.
 */
import { LEAGUES } from "../src/config/leagues";
import { pickLeague } from "../src/lib/apifootball/mappers";
import type { ApiLeagueItem } from "../src/lib/apifootball/types";

const key = process.env.API_FOOTBALL_KEY;
if (!key) {
  console.error("Nedostaje API_FOOTBALL_KEY (u .env.local).");
  process.exit(1);
}

for (const cfg of LEAGUES) {
  const url = new URL("https://v3.football.api-sports.io/leagues");
  if (cfg.apiFootballId) url.searchParams.set("id", String(cfg.apiFootballId));
  else {
    url.searchParams.set("country", cfg.country);
    url.searchParams.set("type", cfg.type);
  }
  const res = await fetch(url, { headers: { "x-apisports-key": key } });
  const body = (await res.json()) as { errors: unknown; response: ApiLeagueItem[] };
  const picked = pickLeague(body.response ?? [], cfg);
  if (picked) {
    console.log(`✓ ${cfg.name.padEnd(16)} id=${picked.id}  "${picked.name}"  sezona ${picked.season}`);
  } else {
    console.log(`✗ ${cfg.name.padEnd(16)} nije pronađena. Kandidati u ${cfg.country}:`);
    for (const i of body.response ?? []) console.log(`    id=${i.league.id}  ${i.league.name} (${i.league.type})`);
    if (body.errors && Object.keys(body.errors as object).length) console.log("    greška:", body.errors);
  }
}
