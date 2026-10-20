import { useSyncExternalStore } from 'react'

export const NAME_KEY = 'karaoke.name'

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
