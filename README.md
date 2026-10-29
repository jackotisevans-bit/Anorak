# Anorak

A painting guessing game built from the open-access collections of the world's great museums.

- **Daily puzzle:** the same 5 paintings for everyone, each day.
- **Endless:** keep guessing for the highest score and a place on the leaderboard.

Players score for any detail they get right, from the country a painting was made in up to its title,
and can spend points on up to 4 clues per painting.

## Running it

```bash
npm install
npm run dev          # the website, at http://localhost:3000
npm run catalogue    # rebuild data/catalogue.json from the museum collections
```

## The painting catalogue

`npm run catalogue` collects public-domain (CC0) paintings from:

| Museum | API |
| --- | --- |
| Art Institute of Chicago | https://api.artic.edu/docs/ |
| The Metropolitan Museum of Art | https://metmuseum.github.io/ |
| Cleveland Museum of Art | https://openaccess-api.clevelandart.org/ |

Each museum's data is mapped to one shape (`src/lib/painting.ts`), then gaps in city, country and
art movement are filled from Wikidata, matched on the museum's inventory number. Wikidata also gives
each painting a rough fame score: how many Wikipedia languages have an article on it.

Pass source ids to refresh only some museums, e.g. `npm run catalogue -- aic cma`. A source that
fails keeps its paintings from the previous build. Coverage of each answer field is written to
`data/catalogue-report.md`.
