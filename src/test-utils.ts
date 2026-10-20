import type { Joined, RoomLike } from './net'

export function installLocalStorage() {
  const mem = new Map<string, string>()
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    },
  })
  return mem
}

// Minimal in-memory stand-in for a Trystero room shared by several peers
export class Hub {
  peers = new Map<string, FakeRoom>()
  join(id: string): Joined {
    const room = new FakeRoom(id, this)
    this.peers.set(id, room)
    for (const [pid, p] of this.peers) {
      if (pid === id) continue
      queueMicrotask(() => {
        p.onPeerJoin?.(id)
        room.onPeerJoin?.(pid)
      })
    }
    return { room, selfId: id }
  }
}

export class FakeRoom implements RoomLike {
  onPeerJoin: RoomLike['onPeerJoin']
  onPeerLeave: RoomLike['onPeerLeave']
  actions = new Map<string, { onMessage: ((d: unknown, c: { peerId: string }) => void) | null }>()
  id: string
  private hub: Hub
  constructor(id: string, hub: Hub) {
    this.id = id
    this.hub = hub
  }
  makeAction(name: string) {
    const { id, hub, actions } = this
    const a = {
      onMessage: null as ((d: unknown, c: { peerId: string }) => void) | null,
      send(data: unknown, opts?: { target?: string }) {
        const copy = JSON.parse(JSON.stringify(data))
        for (const [pid, p] of hub.peers) {
          if (pid === id || (opts?.target && opts.target !== pid)) continue
          queueMicrotask(() => p.actions.get(name)?.onMessage?.(copy, { peerId: id }))
        }
      },
    }
    actions.set(name, a)
    return a
  }
  leave() {
    this.hub.peers.delete(this.id)
    for (const p of this.hub.peers.values()) p.onPeerLeave?.(this.id)
  }
}

export const tick = () => new Promise((r) => setTimeout(r, 25))
