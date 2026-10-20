import { beforeEach, describe, expect, it } from 'vitest'
import {
  STORAGE_KEY, addToQueue, getState, hydrate, moveInQueue, playNext,
  removeFromQueue, savePosition, startSession, endSession,
} from './store'

const mem = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
})

const song = (n: number) => ({ videoId: `vid${String(n).padStart(8, '0')}`, title: `Song ${n}`, singer: 'Ann' })

beforeEach(() => {
  mem.clear()
  endSession()
  startSession()
})

describe('store', () => {
  it('queues, reorders, removes and plays in turn', () => {
    addToQueue(song(1))
    addToQueue(song(2))
    addToQueue(song(3))
    const ids = getState()!.queue.map((q) => q.id)
    moveInQueue(ids[2], -1)
    expect(getState()!.queue.map((q) => q.title)).toEqual(['Song 1', 'Song 3', 'Song 2'])
    removeFromQueue(ids[0])
    playNext()
    expect(getState()!.nowPlaying!.item.title).toBe('Song 3')
    playNext()
    playNext()
    expect(getState()!.nowPlaying).toBeNull()
  })

  it('survives a refresh', () => {
    addToQueue(song(1))
    addToQueue(song(2))
    playNext()
    savePosition(42)
    const code = getState()!.roomCode
    hydrate()
    expect(getState()!.roomCode).toBe(code)
    expect(getState()!.nowPlaying!.positionSec).toBe(42)
    expect(getState()!.queue).toHaveLength(1)
  })

  it('makes unguessable 6-character room codes', () => {
    expect(getState()!.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('rejects malformed saved sessions', () => {
    const ok = getState()!
    for (const bad of [{ ...ok, queue: 'x' }, { ...ok, queue: [{ id: '1' }] }, { ...ok, roomCode: 5 }, { ...ok, nowPlaying: { item: {} } }, null, 7]) {
      mem.set(STORAGE_KEY, JSON.stringify(bad))
      hydrate()
      expect(getState()).toBeNull()
    }
  })

  it('discards stale or invalid data', () => {
    const s = { ...getState()!, createdAt: Date.now() - 25 * 3600 * 1000 }
    mem.set(STORAGE_KEY, JSON.stringify(s))
    hydrate()
    expect(getState()).toBeNull()
    mem.set(STORAGE_KEY, '{bad')
    hydrate()
    expect(getState()).toBeNull()
  })
})
