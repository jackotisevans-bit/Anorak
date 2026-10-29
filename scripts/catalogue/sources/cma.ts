// Cleveland Museum of Art: https://openaccess-api.clevelandart.org/
// Works with share_license_status "CC0" are free to reuse.

import type { Painting } from "../../../src/lib/painting";
import { artistName, text, year } from "../clean";
import { getJson, log } from "../http";

const API = "https://openaccess-api.clevelandart.org/api/artworks/";
const PAGE_SIZE = 500;

interface CmaImage {
  url: string;
  width: string | number;
  height: string | number;
}

interface CmaArtwork {
  id: number;
  accession_number: string;
  share_license_status: string;
  url: string;
  title: string;
  type: string;
  creation_date: string | null;
  creation_date_earliest: number | null;
  creation_date_latest: number | null;
  creators: { description: string; role: string }[];
  culture: string[];
  technique: string | null;
  images: { web?: CmaImage; print?: CmaImage; full?: CmaImage } | null;
  is_highlight?: boolean;
}

interface CmaPage {
  info: { total: number };
  data: CmaArtwork[];
}

export async function fetchCma(): Promise<Painting[]> {
  const paintings: Painting[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const res = await getJson<CmaPage>(
      `${API}?type=Painting&cc0=1&has_image=1&limit=${PAGE_SIZE}&skip=${skip}`,
    );
    for (const work of res.data) {
      const painting = toPainting(work);
      if (painting) paintings.push(painting);
    }
    log("cma", `${Math.min(skip + PAGE_SIZE, res.info.total)} of ${res.info.total} checked`);
    if (skip + PAGE_SIZE >= res.info.total || res.data.length === 0) break;
  }
  return paintings;
}

function toPainting(work: CmaArtwork): Painting | null {
  const title = text(work.title);
  // "print" is about 3400px on the long side; "full" can be a 100MB+ TIFF.
  const image = work.images?.print ?? work.images?.web;
  if (!title || !image || work.share_license_status !== "CC0" || work.type !== "Painting") return null;

  const creator = work.creators.find((c) => /artist|painter/i.test(c.role)) ?? work.creators[0];
  return {
    id: `cma:${work.id}`,
    source: "cma",
    sourceId: String(work.id),
    accessionNumber: text(work.accession_number),
    sourceUrl: work.url,
    title,
    // Descriptions look like "Claude Monet (French, 1840–1926)".
    artist: artistName(creator?.description.split(" (")[0]),
    yearStart: year(work.creation_date_earliest),
    yearEnd: year(work.creation_date_latest),
    dateText: text(work.creation_date),
    // Culture looks like "France, 19th century".
    country: text(work.culture[0]?.split(",")[0]),
    city: null,
    movement: null,
    medium: text(work.technique),
    image: { url: image.url, width: Number(image.width) || null, height: Number(image.height) || null },
    license: "CC0",
    museumHighlight: work.is_highlight ?? false,
    wikidataId: null,
    wikipediaLanguages: 0,
  };
}
