const USER_AGENT = "Anorak painting quiz catalogue builder (https://github.com/jackotisevans-bit/anorak)";

export async function getJson<T>(url: string, init: RequestInit = {}, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init.headers },
      });
      if (res.ok) return (await res.json()) as T;
      // 4xx other than rate limiting will not get better on retry.
      if (res.status !== 429 && res.status < 500) {
        throw new HttpError(`${res.status} ${res.statusText} for ${url}`, res.status);
      }
      if (attempt >= attempts) throw new HttpError(`${res.status} after ${attempts} tries for ${url}`, res.status);
    } catch (err) {
      if (err instanceof HttpError && err.status !== 429 && err.status < 500) throw err;
      if (attempt >= attempts) throw err;
    }
    await sleep(1000 * 2 ** attempt);
  }
}

export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `fn` over `items` with at most `limit` calls in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function log(source: string, message: string) {
  console.log(`[${source}] ${message}`);
}
