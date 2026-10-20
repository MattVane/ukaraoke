import { useCallback, useEffect, useState } from 'react'
import { hydrate } from './store'

export const HOST_LOCK = 'karaoke-host'

export interface HostLock {
  release(): void
}

type Locks = Pick<LockManager, 'request'>

// Resolves with a lock handle, or null when another tab holds it (unless stealing).
// A short wait absorbs our own just-released lock (effect re-runs, React StrictMode).
// onLost fires if another tab later steals the lock from us.
export function acquireHostLock(
  opts: { steal?: boolean; waitMs?: number; onLost: () => void },
  locks: Locks,
): Promise<HostLock | null> {
  return new Promise((resolve) => {
    let acquired = false
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), opts.waitMs ?? 500)
    locks
      .request(HOST_LOCK, opts.steal ? { steal: true } : { signal: abort.signal }, () => {
        acquired = true
        clearTimeout(timer)
        return new Promise<void>((release) => resolve({ release }))
      })
      .catch(() => {
        clearTimeout(timer)
        resolve(null)
        if (acquired) opts.onLost()
      })
  })
}

export type HostLockStatus = 'idle' | 'checking' | 'held' | 'blocked'

const locksSupported = () => typeof navigator !== 'undefined' && !!navigator.locks

// Web Locks only exist in secure contexts; elsewhere there is nothing to coordinate with.
// `room` is the hosted room code (undefined when not hosting).
export function useHostLock(room: string | undefined) {
  const [attempt, setAttempt] = useState({ n: 0, steal: false })
  // Results are tagged with the room and attempt that produced them, so a stale one is never taken as current
  const [result, setResult] = useState<{ tag: string; status: 'held' | 'blocked' } | null>(null)
  const tag = `${room}:${attempt.n}`

  useEffect(() => {
    if (!room || !locksSupported()) return
    let cancelled = false
    let lock: HostLock | null = null
    if (attempt.steal) hydrate() // pick up whatever the previous host tab saved
    acquireHostLock(
      { steal: attempt.steal, onLost: () => !cancelled && setResult({ tag, status: 'blocked' }) },
      navigator.locks,
    ).then((l) => {
      if (cancelled) return l?.release()
      lock = l
      setResult({ tag, status: l ? 'held' : 'blocked' })
    })
    return () => {
      cancelled = true
      lock?.release()
    }
  }, [room, attempt, tag])

  let status: HostLockStatus
  if (!room) status = 'idle'
  else if (!locksSupported()) status = 'held'
  else status = result?.tag === tag ? result.status : 'checking'

  // While blocked, follow the host tab's changes so ending the session there ends it here
  useEffect(() => {
    if (status !== 'blocked') return
    const onStorage = () => hydrate()
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [status])

  const takeOver = useCallback(() => setAttempt((a) => ({ n: a.n + 1, steal: true })), [])
  return { status, takeOver }
}

