import { useSyncExternalStore } from 'react'

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

export const STORAGE_KEY = 'karaoke.session'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

let state: SessionState | null = null
const listeners = new Set<() => void>()

function newRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function load(): SessionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionState
    if (parsed.v !== 1 || Date.now() - parsed.createdAt > MAX_AGE_MS) return null
    return parsed
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
  set({ ...state, queue: [...state.queue, { ...item, id: crypto.randomUUID() }] })
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
