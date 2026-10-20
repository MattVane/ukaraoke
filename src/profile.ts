import { useSyncExternalStore } from 'react'

export const NAME_KEY = 'ukaraoke.name'
export const SECRET_KEY = 'ukaraoke.secret'

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

// Private per-device secret. It is sent only to the host, which derives the public ID from it,
// so nobody can act as another guest just by copying the ID shown on their songs.
export function getSecret(): string {
  let s = localStorage.getItem(SECRET_KEY)
  if (!s || s.length < 16) {
    s = hex(crypto.getRandomValues(new Uint8Array(24)))
    localStorage.setItem(SECRET_KEY, s)
  }
  return s
}

export async function deriveClientId(secret: string): Promise<string> {
  if (!globalThis.crypto?.subtle) return `local-${secret.slice(0, 8)}` // insecure origin: P2P can't run anyway
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ukaraoke:${secret}`))
  return hex(new Uint8Array(digest)).slice(0, 32)
}

let clientId = ''

// Must resolve before the UI renders so getClientId is available synchronously
export async function initIdentity() {
  clientId = await deriveClientId(getSecret())
}

// Public ID used to decide who owns which queue items
export const getClientId = () => clientId

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
