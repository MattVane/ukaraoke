/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadYT } from './yt'
import { getBlocked, isPermanent, markBlocked } from './unplayable'

const SETTLE_MS = 1200
const TIMEOUT_MS = 8000
const MAX_CONCURRENT = 2
const cache = new Map<string, Promise<boolean>>()

// Hidden players are heavy, so only a couple run at once and the rest wait their turn
let active = 0
const waiting: (() => void)[] = []
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r))
  active++
  try {
    return await fn()
  } finally {
    active--
    waiting.shift()?.()
  }
}

// Loads the video in a hidden player to see whether YouTube allows embedding it.
// Resolves true when playable (or when we can't tell), false when permanently blocked.
export function probeEmbeddable(videoId: string): Promise<boolean> {
  if (getBlocked().includes(videoId)) return Promise.resolve(false)
  let p = cache.get(videoId)
  if (!p) {
    p = slot(() => run(videoId)).then((ok) => {
      if (!ok) markBlocked(videoId)
      return ok
    })
    cache.set(videoId, p)
  }
  return p
}

async function run(videoId: string): Promise<boolean> {
  let YT: any
  try {
    YT = await loadYT()
  } catch {
    return true
  }
  return new Promise<boolean>((resolve) => {
    const holder = document.createElement('div')
    holder.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden'
    const el = document.createElement('div')
    holder.appendChild(el)
    document.body.appendChild(holder)
    let player: any
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      clearTimeout(timeout)
      try { player?.destroy() } catch { /* already gone */ }
      holder.remove()
      resolve(ok)
    }
    const timeout = setTimeout(() => finish(true), TIMEOUT_MS)
    player = new YT.Player(el, {
      videoId,
      width: 1,
      height: 1,
      playerVars: { autoplay: 0, controls: 0 },
      events: {
        onReady: () => setTimeout(() => finish(true), SETTLE_MS),
        onError: (e: any) => finish(!isPermanent(e.data)),
      },
    })
  })
}
