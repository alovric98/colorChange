import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { requireEnv } from "@/lib/env";
import { formatDateLong } from "@/lib/dates";
import { AiMatchSchema, type AiMatchAnalysis, type MatchFacts, type SourceLink } from "./types";
import { extractJson } from "./json";

export const MODEL = "claude-sonnet-5-5";

const SYSTEM_PROMPT = `Ti si nogometni analitičar koji piše za hrvatski program utakmice. Pišeš na hrvatskom jeziku, kratko i konkretno.

Dobivaš blok PODACI (JSON) koji je aplikacija prikupila iz API-Footballa: tablicu, formu, međusobne susrete, izostanke, koeficijente i izračunate vjerojatnosti 1/X/2 (te Poissonove procjene ako postoje).

Pravila:
1. Svaka brojka u "reasons" mora doslovno postojati u PODACIMA ili biti izravno izvediva iz njih (npr. zbroj bodova iz forme, razlika u bodovima, broj pobjeda u zadnjih 5). Ne koristi brojke s weba, iz sjećanja ili procjene koje nisu u PODACIMA.
2. Web pretragu koristi samo za kontekst: najave, izjave trenera, očekivane sastave, potvrdu ozljeda. To smiješ opisati riječima u "verdict" i "note", bez novih brojki.
3. Ništa ne izmišljaj. Ako nešto nije u PODACIMA i nisi ga našao pretragom, napiši "Podaci nisu bili dostupni" ili to izostavi. Ako je polje u PODACIMA null, taj podatak nije dostupan.
4. "verdict": jedna rečenica o tome kako bi utakmica mogla proći.
5. "mainTip": točan rezultat koji je u skladu s vjerojatnostima (favorit po vjerojatnosti ne bi trebao gubiti u tipu bez jakog razloga iz podataka).
6. "extraTip.market": jedan od 1X, X2, 12, BTTS_YES, BTTS_NO, OVER_2_5, UNDER_2_5 – onaj koji podaci najbolje podržavaju.
7. "reasons": 3 do 5 kratkih razloga, svaki s barem jednom konkretnom brojkom iz PODATAKA.
8. "note": kratka napomena (sastavi, vijesti, motivacija) ili prazan string.
9. "sources": samo stranice koje si stvarno otvorio ili dobio u rezultatima pretrage (naslov i URL), najviše 5. Bez pretrage: prazan niz.

Odgovor: SAMO jedan JSON objekt, bez markdowna i bez teksta prije ili poslije, točno ovog oblika:
{"verdict": string, "mainTip": {"home": int, "away": int}, "extraTip": {"market": string}, "reasons": string[], "note": string, "sources": [{"title": string, "url": string}]}`;

let client: Anthropic | undefined;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY"), timeout: 170_000, maxRetries: 2 });
  return client;
}

function factsForPrompt(f: MatchFacts) {
  // Boje i skraćenice su samo za sučelje.
  const team = (t: MatchFacts["home"]) => {
    const rest: Partial<MatchFacts["home"]> = { ...t };
    delete rest.color;
    delete rest.short;
    return rest;
  };
  return { ...f, home: team(f.home), away: team(f.away) };
}

interface ClaudeRun {
  text: string;
  seenUrls: Set<string>;
}

async function callClaude(userContent: string): Promise<ClaudeRun> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: userContent }];
  const seenUrls = new Set<string>();

  for (let attempt = 0; attempt < 4; attempt++) {
    const message = await anthropic()
      .beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        // Ako sigurnosni klasifikator odbije zahtjev, API ga sam ponovi na zamjenskom modelu.
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
        messages,
      })
      .finalMessage();

    // Zapamti URL-ove koje je pretraga stvarno vratila (za provjeru izvora).
    for (const block of message.content as unknown as Record<string, unknown>[]) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content as { url?: string }[]) if (r.url) seenUrls.add(r.url);
      }
      if (block.type === "text" && Array.isArray(block.citations)) {
        for (const c of block.citations as { url?: string }[]) if (c.url) seenUrls.add(c.url);
      }
    }

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });
      continue;
    }
    if (message.stop_reason === "refusal") {
      throw new Error("Model je odbio zahtjev.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error("Odgovor modela je prekinut (max_tokens).");
    }

    // Završni odgovor: tekst nakon zadnjeg rezultata pretrage.
    const blocks = message.content as unknown as { type: string; text?: string }[];
    let lastTool = -1;
    blocks.forEach((b, i) => {
      if (b.type.endsWith("_tool_result") || b.type === "server_tool_use") lastTool = i;
    });
    const text = blocks
      .slice(lastTool + 1)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    return { text, seenUrls };
  }
  throw new Error("Pretraga nije završila u dopuštenom broju koraka.");
}

/**
 * Generira presudu, tipove i razloge za jednu utakmicu.
 * Odgovor se validira zodom; ako ne prođe, pokušava se jednom ponovno.
 */
export async function analyseMatch(
  facts: MatchFacts,
  date: string,
): Promise<{ ai: AiMatchAnalysis; sources: SourceLink[] }> {
  const base =
    `Utakmica: ${facts.home.name} – ${facts.away.name} (${facts.league.name}), ${formatDateLong(date)}.\n` +
    `Potraži najnovije vijesti i očekivane sastave za ovu utakmicu, zatim vrati JSON.\n\n` +
    `PODACI:\n${JSON.stringify(factsForPrompt(facts))}`;

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? base
        : `${base}\n\nPrethodni odgovor nije prošao provjeru sheme (${lastError}). Vrati isključivo ispravan JSON po zadanom obliku.`;
    const run = await callClaude(prompt);
    const parsed = AiMatchSchema.safeParse(extractJson(run.text));
    if (parsed.success) {
      const sources = parsed.data.sources.filter((s) => run.seenUrls.has(s.url));
      return { ai: { ...parsed.data, sources }, sources };
    }
    lastError = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "odgovor"}: ${i.message}`)
      .join("; ");
    console.warn(`[claude] neispravan JSON (pokušaj ${attempt + 1}):`, lastError);
  }
  throw new Error(`Claude nije vratio ispravan JSON: ${lastError}`);
}
