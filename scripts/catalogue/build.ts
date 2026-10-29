// Builds data/catalogue.json from every museum source, then writes a coverage report.
//
//   npm run catalogue                 # all sources
//   npm run catalogue -- aic cma      # only some sources (the existing catalogue keeps the rest)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Painting, SourceId } from "../../src/lib/painting";
import { log } from "./http";
import { fetchAic } from "./sources/aic";
import { fetchCma } from "./sources/cma";
import { fetchMet } from "./sources/met";
import { enrichFromWikidata } from "./wikidata";

const SOURCES: Record<SourceId, { name: string; fetch: () => Promise<Painting[]> }> = {
  aic: { name: "Art Institute of Chicago", fetch: fetchAic },
  met: { name: "The Metropolitan Museum of Art", fetch: fetchMet },
  cma: { name: "Cleveland Museum of Art", fetch: fetchCma },
};

const DATA_DIR = path.join(process.cwd(), "data");
const CATALOGUE = path.join(DATA_DIR, "catalogue.json");
const REPORT = path.join(DATA_DIR, "catalogue-report.md");

async function main() {
  const requested = process.argv.slice(2) as SourceId[];
  const unknown = requested.filter((s) => !(s in SOURCES));
  if (unknown.length) throw new Error(`Unknown source(s): ${unknown.join(", ")}. Use ${Object.keys(SOURCES).join(", ")}.`);
  const toFetch = requested.length ? requested : (Object.keys(SOURCES) as SourceId[]);

  // Keep paintings from sources we are not refreshing, or that fail this time.
  const previous = await readCatalogue();
  const bySource = new Map<SourceId, Painting[]>();
  for (const p of previous) bySource.set(p.source, [...(bySource.get(p.source) ?? []), p]);

  for (const source of toFetch) {
    try {
      const fresh = await SOURCES[source].fetch();
      log(source, `${fresh.length} paintings`);
      bySource.set(source, fresh);
      await enrichFromWikidata(fresh);
    } catch (err) {
      log(source, `failed, keeping ${bySource.get(source)?.length ?? 0} paintings from the last build: ${(err as Error).message}`);
    }
  }

  const paintings = [...bySource.values()].flat().sort((a, b) => a.id.localeCompare(b.id));
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CATALOGUE, JSON.stringify(paintings, null, 1) + "\n");
  await writeFile(REPORT, report(paintings));
  log("catalogue", `wrote ${paintings.length} paintings to ${path.relative(process.cwd(), CATALOGUE)}`);
}

async function readCatalogue(): Promise<Painting[]> {
  try {
    return JSON.parse(await readFile(CATALOGUE, "utf8")) as Painting[];
  } catch {
    return [];
  }
}

function report(paintings: Painting[]): string {
  const pct = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : "–");
  const fields = ["artist", "country", "city", "movement", "yearStart"] as const;
  const rows = (Object.keys(SOURCES) as SourceId[]).map((source) => {
    const list = paintings.filter((p) => p.source === source);
    const famous = list.filter((p) => p.wikipediaLanguages >= 3 || p.museumHighlight).length;
    const cells = fields.map((f) => pct(list.filter((p) => p[f] != null).length, list.length));
    return `| ${SOURCES[source].name} | ${list.length} | ${cells.join(" | ")} | ${famous} |`;
  });
  return [
    "# Catalogue coverage",
    "",
    `Generated ${new Date().toISOString().slice(0, 10)}. ${paintings.length} paintings in total.`,
    "",
    "Percentages show how many paintings have each answer field filled in.",
    '"Well known" means the museum marks it as a highlight, or it has Wikipedia articles in 3+ languages.',
    "",
    "| Museum | Paintings | Artist | Country | City | Movement | Date | Well known |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
  ].join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
