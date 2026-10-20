import { useSyncExternalStore } from 'react'
import { uuid } from './id'
import { parseItem } from './protocol'

export interface QueueItem {
  id: string
  videoId: string
  title: string
  thumb?: string
  singer: string
  // Client ID of whoever added it; decides who may remove or reorder it
  addedBy?: string
}

export interface SessionState {
  v: 1
  roomCode: string
  createdAt: number
  queue: QueueItem[]
  nowPlaying: { item: QueueItem; positionSec: number } | null
}

export const STORAGE_KEY = 'ukaraoke.session'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

let state: SessionState | null = null
const listeners = new Set<() => void>()

export const ROOM_CODE_LENGTH = 6

// Alphabet size divides 256, so random bytes map to characters without bias
function newRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH)), (b) => chars[b % chars.length]).join('')
}

export function parseSession(raw: unknown): SessionState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const s = raw as Record<string, unknown>
  if (s.v !== 1 || typeof s.roomCode !== 'string' || !/^[A-Z0-9]{4,16}$/.test(s.roomCode)) return null
  if (typeof s.createdAt !== 'number' || Date.now() - s.createdAt > MAX_AGE_MS) return null
  if (!Array.isArray(s.queue)) return null
  const queue = s.queue.map(parseItem)
  if (queue.some((q) => q === null)) return null
  let nowPlaying: SessionState['nowPlaying'] = null
  if (s.nowPlaying != null) {
    const np = s.nowPlaying as Record<string, unknown>
    const item = parseItem(np?.item)
    if (!item) return null
    nowPlaying = { item, positionSec: typeof np.positionSec === 'number' && np.positionSec >= 0 ? np.positionSec : 0 }
  }
  return { v: 1, roomCode: s.roomCode, createdAt: s.createdAt, queue: queue as QueueItem[], nowPlaying }
}

function load(): SessionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? parseSession(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function set(next: SessionState | null) {
  state = next
  if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  else localStorage.removeItem(STORAGE_KEY)
  listeners.forEach((l) => l())
}

export function hydrate() {
  state = load()
  if (!state) localStorage.removeItem(STORAGE_KEY)
  listeners.forEach((l) => l())
}

export const getState = () => state

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useSession() {
  return useSyncExternalStore(subscribe, getState)
}

export function startSession() {
  set({ v: 1, roomCode: newRoomCode(), createdAt: Date.now(), queue: [], nowPlaying: null })
}

export function endSession() {
  set(null)
}

export function addToQueue(item: Omit<QueueItem, 'id'>) {
  if (!state) return
  set({ ...state, queue: [...state.queue, { ...item, id: uuid() }] })
}

// Adds a song and starts it straight away when nothing is playing
export function enqueue(item: Omit<QueueItem, 'id'>) {
  addToQueue(item)
  if (state && !state.nowPlaying) playNext()
}

export function removeFromQueue(id: string) {
  if (!state) return
  set({ ...state, queue: state.queue.filter((q) => q.id !== id) })
}

export function moveInQueue(id: string, delta: -1 | 1) {
  if (!state) return
  const queue = [...state.queue]
  const i = queue.findIndex((q) => q.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= queue.length) return
  ;[queue[i], queue[j]] = [queue[j], queue[i]]
  set({ ...state, queue })
}

export function playNext() {
  if (!state) return
  const [next, ...rest] = state.queue
  set({ ...state, queue: rest, nowPlaying: next ? { item: next, positionSec: 0 } : null })
}

export function savePosition(positionSec: number) {
  if (!state?.nowPlaying) return
  set({ ...state, nowPlaying: { ...state.nowPlaying, positionSec } })
}
