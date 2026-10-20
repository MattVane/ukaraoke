import { useSyncExternalStore } from 'react'
import { uuid } from './id'

export const NAME_KEY = 'ukaraoke.name'
export const CLIENT_KEY = 'ukaraoke.clientId'

// Stable per-device ID, used to decide who owns which queue items
export function getClientId(): string {
  let id = localStorage.getItem(CLIENT_KEY)
  if (!id) {
    id = uuid()
    localStorage.setItem(CLIENT_KEY, id)
  }
  return id
}

const listeners = new Set<() => void>()

export function getName(): string {
  try {
    return localStorage.getItem(NAME_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function setName(name: string) {
  const clean = name.trim().slice(0, 30)
  if (!clean) return
  localStorage.setItem(NAME_KEY, clean)
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useName() {
  return useSyncExternalStore(subscribe, getName)
}
