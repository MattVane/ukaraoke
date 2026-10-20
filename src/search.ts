export interface SearchResult {
  videoId: string
  title: string
  thumb: string
  channel: string
  durationSec: number
}

// Public Piped API instances, tried in order until one responds
export const DEFAULT_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
]

const TIMEOUT_MS = 8000

interface PipedItem {
  url?: string
  type?: string
  title?: string
  uploaderName?: string
  duration?: number
  isShort?: boolean
}

export function parseResults(json: unknown): SearchResult[] {
  const items = (json as { items?: PipedItem[] })?.items
  if (!Array.isArray(items)) throw new Error('Unexpected search response')
  const out: SearchResult[] = []
  for (const it of items) {
    const videoId = it.url?.match(/[?&]v=([\w-]{11})/)?.[1]
    if (it.type !== 'stream' || it.isShort || !videoId || !it.title) continue
    out.push({
      videoId,
      title: it.title,
      // Use YouTube's own thumbnail host rather than the instance's proxy
      thumb: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      channel: it.uploaderName ?? '',
      durationSec: it.duration ?? 0,
    })
  }
  return out
}

export const buildQuery = (q: string) => (/karaoke/i.test(q) ? q.trim() : `${q.trim()} karaoke`)

// YouTube's oEmbed endpoint answers 401/403 for videos whose owner blocked embedding
export async function filterEmbeddable(
  results: SearchResult[],
  fetchFn: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const checks = await Promise.all(
    results.map(async (r) => {
      try {
        const res = await fetchFn(
          `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${r.videoId}`)}`,
          { signal },
        )
        return ![401, 403, 404].includes(res.status)
      } catch {
        // Keep the result if the check itself fails; the player skips it later
        return true
      }
    }),
  )
  return results.filter((_, i) => checks[i])
}

export async function searchKaraoke(
  query: string,
  opts: { instances?: string[]; fetchFn?: typeof fetch; signal?: AbortSignal; embeddableOnly?: boolean } = {},
): Promise<SearchResult[]> {
  const { instances = DEFAULT_INSTANCES, fetchFn = fetch, signal, embeddableOnly = true } = opts
  const q = encodeURIComponent(buildQuery(query))
  let lastError: unknown = new Error('No search instances configured')
  for (const base of instances) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS)
      const res = await fetchFn(`${base}/search?q=${q}&filter=videos`, {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      })
      if (!res.ok) throw new Error(`${base} responded ${res.status}`)
      const results = parseResults(await res.json())
      return embeddableOnly ? await filterEmbeddable(results, fetchFn, signal) : results
    } catch (e) {
      if (signal?.aborted) throw e
      lastError = e
    }
  }
  throw lastError
}

export function formatDuration(sec: number) {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}
