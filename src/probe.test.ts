import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installLocalStorage } from './test-utils'

installLocalStorage()

interface FakeEvents {
  onReady: () => void
  onError: (e: { data: number }) => void
}

let players: { videoId: string; events: FakeEvents; destroyed: boolean }[] = []

vi.mock('./yt', () => ({
  loadYT: async () => ({
    Player: class {
      rec: { videoId: string; events: FakeEvents; destroyed: boolean }
      constructor(_el: unknown, opts: { videoId: string; events: FakeEvents }) {
        this.rec = { videoId: opts.videoId, events: opts.events, destroyed: false }
        players.push(this.rec)
      }
      destroy() {
        this.rec.destroyed = true
      }
    },
  }),
}))

const fakeEl = () => ({ style: {}, appendChild() {}, remove() {} })
Object.assign(globalThis, {
  document: { createElement: fakeEl, body: { appendChild() {} } },
})

const flush = () => new Promise((r) => setTimeout(r, 0))

async function load() {
  vi.resetModules()
  players = []
  return import('./probe')
}

describe('probeEmbeddable', () => {
  beforeEach(() => vi.useRealTimers())

  it('reports blocked videos and remembers them', async () => {
    const { probeEmbeddable } = await load()
    const { getBlocked } = await import('./unplayable')
    const p = probeEmbeddable('blocked0001')
    await flush()
    players[0].events.onError({ data: 150 })
    expect(await p).toBe(false)
    expect(players[0].destroyed).toBe(true)
    expect(getBlocked()).toContain('blocked0001')
    expect(await probeEmbeddable('blocked0001')).toBe(false)
    expect(players).toHaveLength(1)
  })

  it('treats transient errors as playable and shares one probe per video', async () => {
    const { probeEmbeddable } = await load()
    const a = probeEmbeddable('maybe000001')
    const b = probeEmbeddable('maybe000001')
    await flush()
    expect(players).toHaveLength(1)
    players[0].events.onError({ data: 5 })
    expect(await a).toBe(true)
    expect(await b).toBe(true)
  })

  it('runs at most two probes at a time', async () => {
    const { probeEmbeddable } = await load()
    const results = ['a0000000001', 'b0000000001', 'c0000000001'].map((id) => probeEmbeddable(id))
    await flush()
    expect(players).toHaveLength(2)
    players[0].events.onError({ data: 5 })
    await flush()
    expect(players).toHaveLength(3)
    players[1].events.onError({ data: 5 })
    players[2].events.onError({ data: 5 })
    expect(await Promise.all(results)).toEqual([true, true, true])
  })
})
