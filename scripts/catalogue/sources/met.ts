// The Metropolitan Museum of Art: https://metmuseum.github.io/
// Works marked isPublicDomain are released under CC0. The API asks for at most 80 requests a second.

import type { Painting } from "../../../src/lib/painting";
import { artistName, text, year } from "../clean";
import { getJson, log, mapLimit } from "../http";

const API = "https://collectionapi.metmuseum.org/public/collection/v1";

// Departments that hold paintings. Others (arms, costumes, ...) are skipped outright,
// and every object is still checked for the "Paintings" classification below.
const DEPARTMENTS = {
  americanWing: 1,
  asianArt: 6,
  europeanPaintings: 11,
  islamicArt: 14,
  robertLehman: 15,
  modernAndContemporary: 21,
};

interface MetSearch {
  total: number;
  objectIDs: number[] | null;
}

interface MetObject {
  objectID: number;
  isPublicDomain: boolean;
  isHighlight: boolean;
  primaryImage: string;
  accessionNumber: string;
  title: string;
  artistDisplayName: string;
  objectDate: string;
  objectBeginDate: number;
  objectEndDate: number;
  medium: string;
  classification: string;
  objectName: string;
  country: string;
  city: string;
  objectURL: string;
  objectWikidata_URL: string;
}

export async function fetchMet(): Promise<Painting[]> {
  const ids = new Set<number>();
  for (const [name, departmentId] of Object.entries(DEPARTMENTS)) {
    const res = await getJson<MetSearch>(
      `${API}/search?departmentId=${departmentId}&hasImages=true&q=painting`,
    );
    for (const id of res.objectIDs ?? []) ids.add(id);
    log("met", `${name}: ${res.total} candidates`);
  }

  // European Paintings is all paintings, but a keyword search misses some of them, so list the whole department too.
  const europe = await getJson<{ objectIDs: number[] }>(`${API}/objects?departmentIds=${DEPARTMENTS.europeanPaintings}`);
  for (const id of europe.objectIDs) ids.add(id);
  log("met", `${ids.size} objects to check`);

  let done = 0;
  const objects = await mapLimit([...ids], 20, async (id) => {
    const object = await getJson<MetObject>(`${API}/objects/${id}`).catch(() => null);
    if (++done % 500 === 0) log("met", `checked ${done} of ${ids.size}`);
    return object;
  });

  return objects.flatMap((object) => {
    const painting = object && toPainting(object);
    return painting ? [painting] : [];
  });
}

function toPainting(object: MetObject): Painting | null {
  const title = text(object.title);
  if (!title || !object.isPublicDomain || !object.primaryImage || object.classification !== "Paintings") {
    return null;
  }
  return {
    id: `met:${object.objectID}`,
    source: "met",
    sourceId: String(object.objectID),
    accessionNumber: text(object.accessionNumber),
    sourceUrl: object.objectURL,
    title,
    artist: artistName(object.artistDisplayName),
    yearStart: year(object.objectBeginDate),
    yearEnd: year(object.objectEndDate),
    dateText: text(object.objectDate),
    country: text(object.country),
    city: text(object.city),
    movement: null,
    medium: text(object.medium),
    image: { url: object.primaryImage, width: null, height: null },
    license: "CC0",
    museumHighlight: object.isHighlight,
    wikidataId: wikidataIdFromUrl(object.objectWikidata_URL),
    wikipediaLanguages: 0,
  };
}

function wikidataIdFromUrl(url: string): string | null {
  return /\/(Q\d+)$/.exec(url ?? "")?.[1] ?? null;
}
