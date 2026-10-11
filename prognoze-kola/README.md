# Prognoze kola

Web aplikacija za analizu nogometnih utakmica po ligama i danima. Podaci (utakmice, tablice, forma, međusobni susreti, izostanci, koeficijenti) dolaze iz **API-Footballa**. Presudu, tipove i razloge piše **Claude** (Anthropic API) s web pretragom za vijesti i sastave.

Stack: Next.js 15 (App Router) + TypeScript, Postgres (Neon) + Drizzle ORM, Vercel + Vercel Cron.

> Prognoze su procjena, ne jamstvo. Igraj odgovorno.

---

## 1. Ključevi koje trebaš

| Varijabla | Odakle |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → **API Keys** → *Create Key*. Na računu treba biti kredita (Billing). |
| `API_FOOTBALL_KEY` | Registracija na [dashboard.api-football.com](https://dashboard.api-football.com). Ključ je na početnoj stranici dashboarda. Besplatni plan ima 100 poziva dnevno. |
| `DATABASE_URL` | [neon.tech](https://neon.tech) → novi projekt → **Connection string** (s `?sslmode=require`). Možeš ga dodati i kroz Vercel → Storage → Neon. |
| `CRON_SECRET` | Bilo koji dugi nasumični niz, npr. `openssl rand -hex 32`. |
| `APP_PASSWORD` | Lozinka koju upisuješ prije pokretanja analize (svaki poziv košta). |
| `APP_URL` | Opcionalno: javni URL aplikacije. Na Vercelu nije potreban. |

Ključevi se koriste samo na serveru i nikad ne idu u klijentski kod.

## 2. Pokretanje lokalno

```bash
cd prognoze-kola
npm install
cp .env.example .env.local      # popuni vrijednosti
npm run db:migrate              # kreira tablice u Neonu
npm run leagues:check           # provjeri ID-eve liga preko /leagues
npm run dev                     # http://localhost:3000
```

`leagues:check` za svaku ligu iz `src/config/leagues.ts` ispiše pronađeni API-Football ID i aktualnu sezonu. Aplikacija ID ne pretpostavlja: pronalazi ga preko `/leagues` (država + tip + naziv) i kešira ga tjedan dana. Kad je ID potvrđen, možeš ga upisati u `apiFootballId` i tako preskočiti pretragu.

Testovi, provjera tipova i build:

```bash
npm test
npm run typecheck
npm run build
```

## 3. Migracije baze

Shema je u `src/db/schema.ts`, a migracije u mapi `drizzle/`.

```bash
npm run db:generate   # nakon promjene sheme: generira novu SQL migraciju
npm run db:migrate    # primijeni migracije na bazu iz DATABASE_URL
```

Tablice:
- `analyses`: jedna analiza po paru liga + datum, sa statusom `queued` / `working` / `done` / `error` / `empty` i vremenom ažuriranja
- `match_analyses`: podaci, Claudeova analiza i kasnije stvarni rezultat za svaku utakmicu
- `api_cache`: keš odgovora API-Footballa

## 4. Deploy na Vercel

1. Pushaj repozitorij na GitHub i u Vercelu napravi **New Project** iz njega.
2. **Root Directory** postavi na `prognoze-kola` (aplikacija je u podmapi).
3. U **Settings → Environment Variables** dodaj `ANTHROPIC_API_KEY`, `API_FOOTBALL_KEY`, `DATABASE_URL`, `CRON_SECRET` i `APP_PASSWORD`.
4. Lokalno s produkcijskim `DATABASE_URL` pokreni `npm run db:migrate`.
5. Deploy. Cron poslovi iz `vercel.json` se registriraju automatski.
6. Ako je uključen **Deployment Protection**, provjeri da produkcijska domena nije zaštićena. Pozadinski posao poziva sam sebe (`/api/jobs/process`) za nastavak rada.

Preporuka: uključi **Fluid compute** (zadano na novim projektima) kako bi funkcije mogle raditi do 300 s.

### Cron poslovi

| Putanja | Raspored (UTC) | Što radi |
|---|---|---|
| `/api/cron/daily` | `0 6 * * *` i `0 7 * * *` | U 08:00 po Zagrebu generira današnje analize za sve lige. Vercel Cron radi u UTC-u, pa postoje dva okidača, a ruta se izvršava samo kad je u Zagrebu 8 h (radi i za ljetno i za zimsko vrijeme). |
| `/api/cron/results` | `30 4 * * *` | Upisuje stvarne rezultate odigranih utakmica i pogodak/promašaj tipova. |

Vercel automatski šalje `Authorization: Bearer <CRON_SECRET>`. Ručno pokretanje:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://tvoja-domena/api/cron/daily?force=1"
curl -H "Authorization: Bearer $CRON_SECRET" "https://tvoja-domena/api/cron/results"
```

## 5. Kako radi

1. **Gumb „Analiziraj ovu ligu”** (iza `APP_PASSWORD`) stvori posao sa statusom `queued` i odmah vrati odgovor. Posao radi u pozadini preko `after()`. Stranica svakih 5 s provjerava status i sama se osvježi kad je analiza gotova.
2. **Prikupljanje** (`src/lib/analysis/collect.ts`):
   - jedan poziv za utakmice dana
   - jedan za tablicu
   - jedan za sve završene utakmice sezone (iz toga se računa forma svih momčadi)
   - jedan za koeficijente dana
   - po utakmici još međusobni susreti i izostanci

   Sve se kešira u `api_cache` (tablica 6 h, međusobni susreti 7 dana, izostanci i koeficijenti 3 h…). Za jedno kolo od 10 utakmica to je otprilike 24 poziva, a ponovljeni pregledi ne troše ništa.
3. **Vjerojatnost 1/X/2** (`src/lib/probability.ts`):
   - Ako postoje koeficijenti: p = 1/koeficijent, normalizirano na 100 % (bez marže kladionice). Izvor je „iz koeficijenata kladionica”.
   - Ako ih nema: Poissonov model iz prosjeka zabijenih i primljenih golova (domaćin doma, gost u gostima, relativno prema prosjeku lige), rezultati 0–10. Izvor je „Poissonov model iz golova”.
4. **Claude** (`src/lib/analysis/claude.ts`, model `claude-sonnet-5-5`, web search najviše 4 pretrage po utakmici) dobiva samo prikupljene podatke. Sistemski prompt zahtijeva da sve brojke u razlozima dolaze iz tih podataka. Odgovor je strogi JSON koji se provjerava zodom; ako ne prođe, pokušava se još jednom. Izvori koje Claude navede zadržavaju se samo ako se stvarno pojavljuju u rezultatima pretrage. Uključen je i server-side fallback: ako sigurnosni filtar odbije zahtjev, API ga ponovi na zamjenskom modelu.
5. **Dugi poslovi:** utakmice se obrađuju po tri istovremeno. Ako vrijeme jedne invokacije istekne, posao se nastavlja u novoj. Zapeli posao (bez napretka 6 min) ponovno se pokreće pri sljedećoj provjeri statusa.
6. **„Osvježi analizu”** ponovno dohvaća podatke bez keša za izostanke i koeficijente (npr. kad izađu sastavi). Stara analiza ostaje vidljiva dok nova ne bude gotova.
7. **Povijest** (`/povijest`) prikazuje pogodak/promašaj za glavni tip (točan rezultat) i dodatni tip te uspješnost po ligi i ukupno. Računa se rezultat nakon 90 minuta; odgođene i otkazane utakmice se poništavaju.

Ako neki podatak nedostaje, kartica piše „Podaci nisu bili dostupni”. Ništa se ne nadomješta izmišljenim vrijednostima.

## 6. Dodavanje lige

U `src/config/leagues.ts` dodaj zapis:

```ts
{ key: "eredivisie", name: "Eredivisie", country: "Netherlands", apiNames: ["Eredivisie"], type: "league" },
```

Zatim pokreni `npm run leagues:check` da provjeriš je li liga pronađena. Skraćenice i boje klubova (za okrugle oznake) su u `src/config/teams.ts`. Klub koji nije na popisu dobije automatsku skraćenicu i boju.

## 7. Troškovi i limiti

- **API-Football besplatni plan (100 poziva dnevno)** pokriva otprilike 3–4 lige dnevno uz keš. Za svih 7 liga svaki dan preporučuje se plaćeni plan.
- **Claude:** jedan poziv s web pretragom po utakmici. Zato je gumb zaštićen lozinkom, a cron generira samo današnje utakmice.
