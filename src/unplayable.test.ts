import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installLocalStorage } from './test-utils'

const mem = installLocalStorage()
const item = { videoId: 'xyF04rAhHaQ', title: 'Bohemian Rhapsody' }

async function load() {
  vi.resetModules()
  return import('./unplayable')
}

describe('unplayable videos', () => {
  beforeEach(() => mem.clear())

  it('remembers videos that can never be embedded and explains why', async () => {
    const u = await load()
    u.reportUnplayable(item, 150)
    expect(u.getBlocked()).toEqual([item.videoId])
    expect(u.getNotice()).toEqual({ title: item.title, reason: 'embedding is disabled for this video' })
    expect(JSON.parse(mem.get(u.BLOCKED_KEY)!)).toEqual([item.videoId])
  })

  it('persists the blocked list across reloads and does not duplicate', async () => {
    const first = await load()
    first.reportUnplayable(item, 101)
    first.reportUnplayable(item, 150)
    const second = await load()
    expect(second.getBlocked()).toEqual([item.videoId])
  })

  it('does not blocklist transient player errors but still tells the host', async () => {
    const u = await load()
    u.reportUnplayable(item, 5)
    expect(u.getBlocked()).toEqual([])
    expect(u.getNotice()?.reason).toBe("it couldn't be played")
  })

  it('clears the notice when dismissed or after a while', async () => {
    vi.useFakeTimers()
    try {
      const u = await load()
      u.reportUnplayable(item, 150)
      u.dismissNotice()
      expect(u.getNotice()).toBeNull()
      u.reportUnplayable(item, 150)
      vi.advanceTimersByTime(8001)
      expect(u.getNotice()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('survives corrupt saved data', async () => {
    mem.set('karaoke.blocked', '{not json')
    expect((await load()).getBlocked()).toEqual([])
  })
})
