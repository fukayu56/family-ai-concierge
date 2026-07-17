# TECH_DEBT: Spot mappers / merge (2026-07-17)

Provisional choices made to ship 6-city production spots for tomorrow's family use.

## Provisional items

| Item | Why provisional | Split when | Suggested refactor order |
|---|---|---|---|
| `CuratedSpotsMapper` shared | Anjo/Okazaki/Toyota culture lacked usable CSV today | City gains official CSV/API, or curated update automation starts | 1) keep curated overlay per city folder 2) optional city-specific curated loader |
| City logic not in one giant if | Avoided — city loaders live in SpotService methods | SpotService city methods > 10 or need DI | Extract `CitySpotRepository` |
| NagoyaParkMapper shared across wards | Same CSV schema; do not fork per ward | Schema diverges by ward/year | Keep shared; add adapter only if columns differ |
| Toyota plaza CSV park-biased | Only plaza open data downloaded for volume | Tourism/culture CSV available | Add ToyotaTourismMapper + reduce plaza min-area |
| Merge/Deduplicate in `mergeSpots.ts` | Lightweight city+name+address only | Conflicts > simple key, or geo-merge needed | Dedicated `MergeService` + conflict report API |
| Category normalize helper | Shared keywords | Per-city taxonomy > 5 special cases | `CategoryNormalizer` with city profiles |
| SourceMetadata not formalized | Used flat source/sourceUrl/lastUpdated | Freshness jobs / license checks | Introduce `sourceMetadata` optional object |
| Manual curated refresh | No crawler | Link-rot checks or quarterly refresh | Script + checklist in SOURCES.md |
| Prompt diversity selector | Soft category cap for park flood | Weather-aware rules grow | `PromptCandidateSelector` module |
| Encoding dual files (*.utf8.csv) | Shift-JIS downloads | Normalize to UTF-8 only in ingest script | One-time convert + delete originals |

## Split triggers (explicit)

- Same mapper has **>3 city-specific branches**
- New source is **not the same CSV schema**
- City-specific category transforms **>5**
- Data refresh becomes **automated**
- Dedup conflicts need **human review UI**

## Do not

- Put all municipalities into one mega-if Mapper
- Mark unknown parking/cost as false
- Feed raw CSV/HTML to OpenAI
