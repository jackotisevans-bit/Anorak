// Art Institute of Chicago: https://api.artic.edu/docs/
// Public-domain works are released under CC0. Images are served through IIIF.

import type { Painting } from "../../../src/lib/painting";
import { artistName, text, year } from "../clean";
import { getJson, log } from "../http";

const API = "https://api.artic.edu/api/v1/artworks/search";
const IIIF = "https://www.artic.edu/iiif/2";
const PAGE_SIZE = 100;
// The search endpoint stops paging at 10,000 results.
const MAX_RESULTS = 10_000;
// AIC's artwork type 1 is "Painting".
const PAINTING_TYPE_ID = 1;

const FIELDS = [
  "id",
  "title",
  "main_reference_number",
  "artist_title",
  "date_start",
  "date_end",
  "date_display",
  "place_of_origin",
  "style_title",
  "medium_display",
  "image_id",
  "thumbnail",
  "is_boosted",
  "is_public_domain",
  "artwork_type_id",
];

interface AicArtwork {
  id: number;
  title: string | null;
  main_reference_number: string | null;
  artist_title: string | null;
  date_start: number | null;
  date_end: number | null;
  date_display: string | null;
  place_of_origin: string | null;
  style_title: string | null;
  medium_display: string | null;
  image_id: string | null;
  thumbnail: { width?: number; height?: number } | null;
  is_boosted: boolean;
  is_public_domain: boolean;
  artwork_type_id: number | null;
}

interface AicPage {
  pagination: { total: number };
  data: AicArtwork[];
}

export async function fetchAic(): Promise<Painting[]> {
  const paintings: Painting[] = [];
  for (let page = 1; page * PAGE_SIZE <= MAX_RESULTS; page++) {
    const body = {
      query: {
        bool: {
          must: [
            { term: { is_public_domain: true } },
            { term: { artwork_type_id: PAINTING_TYPE_ID } },
            { exists: { field: "image_id" } },
          ],
        },
      },
      fields: FIELDS,
      limit: PAGE_SIZE,
      page,
    };
    const res = await getJson<AicPage>(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "AIC-User-Agent": "Anorak painting quiz" },
      body: JSON.stringify(body),
    });
    for (const work of res.data) {
      const painting = toPainting(work);
      if (painting) paintings.push(painting);
    }
    log("aic", `page ${page}: ${paintings.length} paintings so far of ${res.pagination.total}`);
    if (page * PAGE_SIZE >= res.pagination.total) break;
  }
  return paintings;
}

function toPainting(work: AicArtwork): Painting | null {
  const title = text(work.title);
  if (!title || !work.image_id || !work.is_public_domain || work.artwork_type_id !== PAINTING_TYPE_ID) {
    return null;
  }
  return {
    id: `aic:${work.id}`,
    source: "aic",
    sourceId: String(work.id),
    accessionNumber: text(work.main_reference_number),
    sourceUrl: `https://www.artic.edu/artworks/${work.id}`,
    title,
    artist: artistName(work.artist_title),
    yearStart: year(work.date_start),
    yearEnd: year(work.date_end),
    dateText: text(work.date_display),
    // AIC's place of origin is usually a country ("France"), sometimes a city or region.
    country: text(work.place_of_origin),
    city: null,
    movement: text(work.style_title),
    medium: text(work.medium_display),
    image: {
      // 1686px is the largest size AIC serves without special arrangement.
      url: `${IIIF}/${work.image_id}/full/1686,/0/default.jpg`,
      width: work.thumbnail?.width ?? null,
      height: work.thumbnail?.height ?? null,
    },
    license: "CC0",
    museumHighlight: work.is_boosted,
    wikidataId: null,
    wikipediaLanguages: 0,
  };
}
