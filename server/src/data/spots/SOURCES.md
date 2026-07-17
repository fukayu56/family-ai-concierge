# Spot data sources (Aichi municipalities)

Fetched/curated for Family AI Concierge MVP. License: respect each city's open-data terms (typically CC-BY 4.0). Do not treat unverified fees/hours as facts.

| City | Dataset | Type | Source URL | Fetched | Data as-of | Method |
|---|---|---|---|---|---|---|
| 刈谷市 | 観光施設 CSV | open data | city Kariya open data catalog | existing | 2026-04-01 | auto local |
| 長久手市 | 観光地 CSV | open data | https://www.city.nagakute.lg.jp/.../18072.html | 2026-07-17 | 2026-07-13 | download |
| 長久手市 | 公園 CSV | open data | same page | 2026-07-17 | 2022-10-07 | download |
| 豊田市 | 地域広場一覧 CSV | open data | https://data.bodik.jp/dataset/232114_urban_parks | 2026-07-17 | 2024-03-31 | download |
| 豊田市 | curated major spots | curated | official city/facility pages | 2026-07-17 | 2026-07-17 | manual |
| 名古屋市 | 都市公園 CSV（区） | open data | https://www.city.nagoya.jp/.../1014871.html / BODIK | 2026-07-17 | 2024-04-01 | download |
| 名古屋市 | curated science/zoo/etc | curated | city official facility pages | 2026-07-17 | 2026-07-17 | manual |
| 安城市 | curated parks/facilities | curated | https://www.city.anjo.aichi.jp/.../tosikouen.html | 2026-07-17 | 2026-07-17 | manual |
| 岡崎市 | curated parks/facilities | curated | https://www.city.okazaki.lg.jp/ | 2026-07-17 | 2026-07-17 | manual |

## Processing notes

- Nagoya parks: keep area ≥ 1.0 ha only (avoid tiny neighborhood parks).
- Toyota plazas: keep area ≥ 2000 ㎡.
- Nagakute parks: keep area ≥ 3000 ㎡.
- Sample fictional spots stay loadable for tests but are **excluded** from production recommendation merge.
- Curated entries always include `source`, `sourceUrl`, `city`, `lastUpdated`.

## Not downloaded today

- Anjo/Okazaki machine-readable tourism CSVs were not found on BODIK under usable family-spot datasets; curated official pages used instead.
- Toyota culture/tourism open CSV beyond plazas was incomplete for family indoor diversity; curated overlay added.
