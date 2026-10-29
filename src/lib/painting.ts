// The shape every painting takes in the catalogue, whichever museum it came from.
// Answer fields (artist, country, city, movement, dates) are null when no source knows them;
// the game only asks about fields a painting actually has.

export type SourceId = "aic" | "met" | "cma";

export interface Painting {
  /** Stable id across rebuilds, e.g. "aic:27992". */
  id: string;
  source: SourceId;
  sourceId: string;
  /** The museum's own accession / inventory number, used to match Wikidata. */
  accessionNumber: string | null;
  /** Page on the museum's website, credited in the game after each round. */
  sourceUrl: string;

  title: string;
  artist: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  /** The museum's date as written, e.g. "c. 1890–95". */
  dateText: string | null;
  country: string | null;
  city: string | null;
  movement: string | null;
  medium: string | null;

  image: {
    url: string;
    width: number | null;
    height: number | null;
  };
  license: "CC0";

  /** The museum flags this as a highlight of its collection. */
  museumHighlight: boolean;
  /** Wikidata item for the painting, when one was matched. */
  wikidataId: string | null;
  /** Number of Wikipedia languages with an article on the painting: a rough fame score. */
  wikipediaLanguages: number;
}
