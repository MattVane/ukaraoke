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
let preferred: string | null = null

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

export async function searchKaraoke(
  query: string,
  opts: { instances?: string[]; fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<SearchResult[]> {
  const { instances = DEFAULT_INSTANCES, fetchFn = fetch, signal } = opts
  const q = encodeURIComponent(buildQuery(query))
  let lastError: unknown = new Error('No search instances configured')
  // Try the instance that worked last first; public instances are often down
  const ordered = preferred && instances.includes(preferred) ? [preferred, ...instances.filter((i) => i !== preferred)] : instances
  for (const base of ordered) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS)
      const res = await fetchFn(`${base}/search?q=${q}&filter=videos`, {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      })
      if (!res.ok) throw new Error(`${base} responded ${res.status}`)
      const results = parseResults(await res.json())
      preferred = base
      return results
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
