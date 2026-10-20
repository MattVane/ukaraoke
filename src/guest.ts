import { useSyncExternalStore } from 'react'
import { connectGuest, type GuestLink, type JoinFn } from './net'
import type { Command, ViewState } from './protocol'

export type GuestStatus = 'connecting' | 'live' | 'waiting'

export interface GuestState {
  roomCode: string
  view: ViewState | null
  status: GuestStatus
}

export const GUEST_KEY = 'ukaraoke.guest'

let state: GuestState | null = null
let link: GuestLink | null = null
const listeners = new Set<() => void>()

function set(next: GuestState | null) {
  state = next
  if (next) localStorage.setItem(GUEST_KEY, JSON.stringify({ roomCode: next.roomCode }))
  else localStorage.removeItem(GUEST_KEY)
  listeners.forEach((l) => l())
}

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

export function joinSession(code: string, join?: JoinFn) {
  const roomCode = normalizeCode(code)
  if (!roomCode) return
  link?.close()
  set({ roomCode, view: null, status: 'connecting' })
  link = connectGuest(
    roomCode,
    {
      onView: (view) => state && state.roomCode === roomCode && set({ ...state, view, status: 'live' }),
      onHostLeft: () => state && state.roomCode === roomCode && set({ ...state, status: 'waiting' }),
    },
    join,
  )
}

// Reconnects after a refresh using the room code saved on this device
export function restoreGuest(join?: JoinFn) {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_KEY) ?? 'null')
    if (typeof saved?.roomCode === 'string') joinSession(saved.roomCode, join)
  } catch {
    localStorage.removeItem(GUEST_KEY)
  }
}

export function leaveSession() {
  link?.close()
  link = null
  set(null)
}

export const sendCommand = (cmd: Command) => link?.send(cmd) ?? false

export const getGuest = () => state

export function subscribeGuest(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useGuest() {
  return useSyncExternalStore(subscribeGuest, getGuest)
}
