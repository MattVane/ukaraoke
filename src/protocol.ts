import type { QueueItem } from './store'

export interface ViewState {
  hostId: string
  roomCode: string
  queue: QueueItem[]
  nowPlaying: QueueItem | null
}

export type Command =
  | { t: 'add'; secret: string; videoId: string; title: string; singer: string }
  | { t: 'remove'; secret: string; id: string }
  | { t: 'move'; secret: string; id: string; delta: -1 | 1 }

export const MAX_QUEUE = 100
const VIDEO_ID = /^[\w-]{11}$/
const MAX_TITLE = 200
const MAX_NAME = 30
const MAX_ID = 64
const MIN_SECRET = 16
const MAX_SECRET = 128

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null)

export const thumbFor = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`

// Everything from the network is untrusted, so rebuild rather than pass through
export function parseCommand(raw: unknown): Command | null {
  if (!isObj(raw)) return null
  const secret = str(raw.secret, MAX_SECRET)
  if (!secret || secret.length < MIN_SECRET) return null
  switch (raw.t) {
    case 'add': {
      const title = str(raw.title, MAX_TITLE)
      const singer = str(raw.singer, MAX_NAME)
      if (typeof raw.videoId !== 'string' || !VIDEO_ID.test(raw.videoId) || !title || !singer) return null
      return { t: 'add', secret, videoId: raw.videoId, title, singer }
    }
    case 'remove': {
      const id = str(raw.id, MAX_ID)
      return id ? { t: 'remove', secret, id } : null
    }
    case 'move': {
      const id = str(raw.id, MAX_ID)
      if (!id || (raw.delta !== -1 && raw.delta !== 1)) return null
      return { t: 'move', secret, id, delta: raw.delta }
    }
    default:
      return null
  }
}

export function parseItem(raw: unknown): QueueItem | null {
  if (!isObj(raw)) return null
  const id = str(raw.id, MAX_ID)
  const title = str(raw.title, MAX_TITLE)
  const singer = str(raw.singer, MAX_NAME)
  if (!id || !title || !singer || typeof raw.videoId !== 'string' || !VIDEO_ID.test(raw.videoId)) return null
  return {
    id,
    videoId: raw.videoId,
    title,
    singer,
    thumb: thumbFor(raw.videoId),
    addedBy: typeof raw.addedBy === 'string' ? raw.addedBy.slice(0, MAX_ID) : undefined,
  }
}

export function parseView(raw: unknown): ViewState | null {
  if (!isObj(raw) || !Array.isArray(raw.queue) || raw.queue.length > MAX_QUEUE) return null
  const hostId = str(raw.hostId, MAX_ID)
  const roomCode = str(raw.roomCode, 16)
  if (!hostId || !roomCode) return null
  const queue = raw.queue.map(parseItem)
  if (queue.some((q) => q === null)) return null
  const nowPlaying = raw.nowPlaying == null ? null : parseItem(raw.nowPlaying)
  if (raw.nowPlaying != null && !nowPlaying) return null
  return { hostId, roomCode, queue: queue as QueueItem[], nowPlaying }
}

export const canManage = (item: QueueItem, clientId: string) => item.addedBy === clientId

// Guests may only remove or reorder songs they added themselves; clientId is derived from their secret
export function authorize(cmd: Command, queue: QueueItem[], clientId: string): boolean {
  switch (cmd.t) {
    case 'add':
      return queue.length < MAX_QUEUE
    case 'remove':
    case 'move': {
      const item = queue.find((q) => q.id === cmd.id)
      return !!item && canManage(item, clientId)
    }
  }
}
