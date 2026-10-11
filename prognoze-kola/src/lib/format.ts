import { TEAM_STYLES } from "@/config/teams";

/** Hrvatska množina: 1 bod, 2 boda, 5 bodova, 21 bod, 12 bodova. */
export function pointsLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} bod`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} boda`;
  return `${n} bodova`;
}

export function formatPercent(p: number): string {
  return `${p.toFixed(1).replace(".", ",")} %`;
}

const SKIP_WORDS = new Set(["fc", "cf", "ac", "as", "sc", "nk", "hnk", "gnk", "afc", "ssc", "rc", "us", "sv", "vfb", "vfl", "1."]);

/** Skraćenica od 3 slova: iz konfiguracije ili izvedena iz imena. */
export function teamShort(name: string): string {
  const configured = TEAM_STYLES[name]?.short;
  if (configured) return configured;
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ");
  const words = clean.split(/\s+/).filter((w) => w && !SKIP_WORDS.has(w.toLowerCase()) && !/^\d+$/.test(w));
  if (words.length === 0) return clean.replace(/\s/g, "").slice(0, 3).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[1].slice(0, 2)).toUpperCase();
}

/** Boja kluba iz konfiguracije ili stabilna boja izvedena iz imena. */
export function teamColor(name: string): string {
  const configured = TEAM_STYLES[name]?.color;
  if (configured) return configured;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 55% 45%)`;
}

/** "Regular Season - 8" → "8. kolo"; ostale faze (npr. "League Stage - 3") → "3. kolo"; inače original. */
export function roundLabel(round: string | null | undefined): string | null {
  if (!round) return null;
  const m = round.match(/^(Regular Season|League Stage|Group Stage)\s*-\s*(\d+)$/i);
  if (m) return `${m[2]}. kolo`;
  return round;
}
