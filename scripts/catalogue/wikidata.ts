// Fills the gaps museums leave (city, movement, country) from Wikidata, and adds a fame score.
// Paintings are matched by their inventory number qualified with the holding museum,
// which Wikidata records for most public-domain paintings in these collections.

import type { Painting, SourceId } from "../../src/lib/painting";
import { getJson, log } from "./http";

const ENDPOINT = "https://query.wikidata.org/sparql";

const MUSEUM_ITEMS: Record<SourceId, string> = {
  aic: "Q239303",
  met: "Q160236",
  cma: "Q657415",
};

interface WikidataPainting {
  item: string;
  sitelinks: number;
  city: string | null;
  country: string | null;
  movement: string | null;
}

interface SparqlResult {
  results: { bindings: Record<string, { value: string } | undefined>[] };
}

const query = (museum: string) => `
SELECT ?item ?inv ?sitelinks
       (SAMPLE(?placeLabel) AS ?place) (SAMPLE(?placeCountryLabel) AS ?placeCountry)
       (SAMPLE(?originLabel) AS ?origin)
       (SAMPLE(?movementLabel) AS ?movement) (SAMPLE(?artistMovementLabel) AS ?artistMovement)
WHERE {
  ?item wdt:P31 wd:Q3305213;
        p:P217 [ ps:P217 ?inv; pq:P195 wd:${museum} ];
        wikibase:sitelinks ?sitelinks.
  OPTIONAL {
    ?item wdt:P1071 ?placeItem.
    ?placeItem rdfs:label ?placeLabel. FILTER(LANG(?placeLabel) = "en")
    OPTIONAL { ?placeItem wdt:P17 ?pc. ?pc rdfs:label ?placeCountryLabel. FILTER(LANG(?placeCountryLabel) = "en") }
    FILTER(!BOUND(?pc) || ?pc != ?placeItem)
  }
  OPTIONAL { ?item wdt:P495 ?o. ?o rdfs:label ?originLabel. FILTER(LANG(?originLabel) = "en") }
  OPTIONAL { ?item wdt:P135 ?m. ?m rdfs:label ?movementLabel. FILTER(LANG(?movementLabel) = "en") }
  OPTIONAL {
    ?item wdt:P170 ?artist. ?artist wdt:P135 ?am.
    ?am rdfs:label ?artistMovementLabel. FILTER(LANG(?artistMovementLabel) = "en")
  }
}
GROUP BY ?item ?inv ?sitelinks`;

async function fetchMuseum(source: SourceId): Promise<Map<string, WikidataPainting>> {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query(MUSEUM_ITEMS[source]))}`;
  const res = await getJson<SparqlResult>(url, { headers: { Accept: "application/sparql-results+json" } });
  const byInventory = new Map<string, WikidataPainting>();
  for (const row of res.results.bindings) {
    const inv = row.inv?.value;
    const item = row.item?.value;
    if (!inv || !item) continue;
    const place = row.place?.value ?? null;
    const placeCountry = row.placeCountry?.value ?? null;
    byInventory.set(normaliseInventory(inv), {
      item: item.split("/").pop()!,
      sitelinks: Number(row.sitelinks?.value ?? 0),
      // A place of creation with a country above it is a city or region; one without is a country.
      city: placeCountry ? place : null,
      country: placeCountry ?? place ?? row.origin?.value ?? null,
      movement: row.movement?.value ?? row.artistMovement?.value ?? null,
    });
  }
  log("wikidata", `${source}: ${byInventory.size} paintings on Wikidata`);
  return byInventory;
}

function normaliseInventory(inv: string): string {
  return inv.toLowerCase().replace(/\s+/g, "");
}

/** Fills empty fields in place. Museum data always wins over Wikidata where both exist. */
export async function enrichFromWikidata(paintings: Painting[]): Promise<void> {
  const sources = [...new Set(paintings.map((p) => p.source))];
  for (const source of sources) {
    let matches: Map<string, WikidataPainting>;
    try {
      matches = await fetchMuseum(source);
    } catch (err) {
      log("wikidata", `${source}: skipped (${(err as Error).message})`);
      continue;
    }
    let matched = 0;
    for (const painting of paintings) {
      if (painting.source !== source || !painting.accessionNumber) continue;
      const match = matches.get(normaliseInventory(painting.accessionNumber));
      if (!match) continue;
      matched++;
      painting.wikidataId ??= match.item;
      painting.wikipediaLanguages = match.sitelinks;
      painting.city ??= match.city;
      painting.country ??= match.country;
      painting.movement ??= match.movement;
    }
    log("wikidata", `${source}: matched ${matched} paintings`);
  }
}
