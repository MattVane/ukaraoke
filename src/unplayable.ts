import { useSyncExternalStore } from 'react'

export const BLOCKED_KEY = 'ukaraoke.blocked'
const MAX_BLOCKED = 500
const NOTICE_MS = 8000

// YouTube player errors that mean this video will never play when embedded
const PERMANENT = new Set([2, 100, 101, 150])

export interface Notice {
  title: string
  reason: string
}

function loadBlocked(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BLOCKED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

let blocked = loadBlocked()
let notice: Notice | null = null
let noticeTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function reasonFor(code: number) {
  return code === 101 || code === 150 ? 'embedding is disabled for this video' : "it couldn't be played"
}

// Called when the player gives up on a video: remember it, tell the host, and let search hide it
export const isPermanent = (code: number) => PERMANENT.has(code)

export function markBlocked(videoId: string) {
  if (blocked.includes(videoId)) return
  blocked = [...blocked, videoId].slice(-MAX_BLOCKED)
  localStorage.setItem(BLOCKED_KEY, JSON.stringify(blocked))
  emit()
}

export function reportUnplayable(item: { videoId: string; title: string }, code: number) {
  if (PERMANENT.has(code)) markBlocked(item.videoId)
  notice = { title: item.title, reason: reasonFor(code) }
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(dismissNotice, NOTICE_MS)
  emit()
}

export function dismissNotice() {
  clearTimeout(noticeTimer)
  notice = null
  emit()
}

export const getBlocked = () => blocked
export const getNotice = () => notice

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export const useBlocked = () => useSyncExternalStore(subscribe, getBlocked)
export const useNotice = () => useSyncExternalStore(subscribe, getNotice)
