import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JoinFn } from './net'
import type { ViewState } from './protocol'
import { Hub, installLocalStorage, tick } from './test-utils'

const mem = installLocalStorage()
const VID = 'dQw4w9WgXcQ'

// Fresh copies of the singleton stores, like a page load
async function load() {
  vi.resetModules()
  return {
    store: await import('./store'),
    host: await import('./host'),
    guest: await import('./guest'),
    net: await import('./net'),
  }
}

const joinAs = (hub: Hub, id: string): JoinFn => () => hub.join(id)
const titles = (v: { queue: { title: string }[] } | null | undefined) => v?.queue.map((q) => q.title)

describe('P2P session integration', () => {
  beforeEach(() => mem.clear())

  it('guest joins by a messy room code and receives the host snapshot', async () => {
    const { store, host, guest } = await load()
    store.startSession()
    const code = store.getState()!.roomCode
    store.enqueue({ videoId: VID, title: 'Playing', singer: 'Host', addedBy: 'h' })
    store.enqueue({ videoId: VID, title: 'Next', singer: 'Host', addedBy: 'h' })
    const hub = new Hub()
    host.startHostLink(code, joinAs(hub, 'host'))

    guest.joinSession(` ${code.toLowerCase().slice(0, 2)}-${code.slice(2)} `, joinAs(hub, 'g1'))
    expect(guest.getGuest()!.status).toBe('connecting')
    await tick()

    expect(guest.getGuest()!.roomCode).toBe(code)
    expect(guest.getGuest()!.status).toBe('live')
    expect(guest.getGuest()!.view!.nowPlaying?.title).toBe('Playing')
    expect(titles(guest.getGuest()!.view)).toEqual(['Next'])
  })

  it('a guest can add songs, and only manage their own', async () => {
    const { store, host, guest } = await load()
    store.startSession()
    const code = store.getState()!.roomCode
    store.enqueue({ videoId: VID, title: 'Playing', singer: 'Host', addedBy: 'h' })
    store.enqueue({ videoId: VID, title: 'Host song', singer: 'Host', addedBy: 'h' })
    const hub = new Hub()
    host.startHostLink(code, joinAs(hub, 'host'))
    guest.joinSession(code, joinAs(hub, 'g1'))
    await tick()

    guest.sendCommand({ t: 'add', clientId: 'g1', videoId: VID, title: 'Guest song', singer: 'Gus' })
    await tick()
    expect(titles(store.getState())).toEqual(['Host song', 'Guest song'])
    expect(store.getState()!.queue[1].singer).toBe('Gus')
    expect(titles(guest.getGuest()!.view)).toEqual(['Host song', 'Guest song'])

    const [hostSong, own] = store.getState()!.queue
    guest.sendCommand({ t: 'remove', clientId: 'g1', id: hostSong.id })
    guest.sendCommand({ t: 'move', clientId: 'g1', id: hostSong.id, delta: 1 })
    await tick()
    expect(titles(store.getState())).toEqual(['Host song', 'Guest song'])

    guest.sendCommand({ t: 'move', clientId: 'g1', id: own.id, delta: -1 })
    await tick()
    expect(titles(store.getState())).toEqual(['Guest song', 'Host song'])

    guest.sendCommand({ t: 'remove', clientId: 'g1', id: own.id })
    await tick()
    expect(titles(store.getState())).toEqual(['Host song'])
    expect(titles(guest.getGuest()!.view)).toEqual(['Host song'])
  })

  it("guests cannot touch each other's songs and all see the same queue", async () => {
    const { store, host, guest, net } = await load()
    store.startSession()
    const code = store.getState()!.roomCode
    store.enqueue({ videoId: VID, title: 'Playing', singer: 'Host', addedBy: 'h' })
    const hub = new Hub()
    host.startHostLink(code, joinAs(hub, 'host'))

    guest.joinSession(code, joinAs(hub, 'g1'))
    let second: ViewState | null = null
    const link2 = net.connectGuest(code, { onView: (v) => (second = v), onHostLeft: () => {} }, joinAs(hub, 'g2'))
    await tick()

    guest.sendCommand({ t: 'add', clientId: 'g1', videoId: VID, title: 'One', singer: 'A' })
    await tick()
    const id = store.getState()!.queue[0].id
    link2.send({ t: 'remove', clientId: 'g2', id })
    await tick()

    expect(titles(store.getState())).toEqual(['One'])
    expect(titles(guest.getGuest()!.view)).toEqual(['One'])
    expect(titles(second)).toEqual(['One'])
  })

  it('host skip is reflected on guests', async () => {
    const { store, host, guest } = await load()
    store.startSession()
    const code = store.getState()!.roomCode
    store.enqueue({ videoId: VID, title: 'First', singer: 'H', addedBy: 'h' })
    store.enqueue({ videoId: VID, title: 'Second', singer: 'H', addedBy: 'h' })
    const hub = new Hub()
    host.startHostLink(code, joinAs(hub, 'host'))
    guest.joinSession(code, joinAs(hub, 'g1'))
    await tick()
    expect(guest.getGuest()!.view!.nowPlaying?.title).toBe('First')

    store.playNext()
    await tick()
    expect(guest.getGuest()!.view!.nowPlaying?.title).toBe('Second')
    expect(guest.getGuest()!.view!.queue).toHaveLength(0)
  })

  it('guest refresh rejoins the saved room and gets the current queue', async () => {
    const first = await load()
    first.store.startSession()
    const code = first.store.getState()!.roomCode
    first.store.enqueue({ videoId: VID, title: 'Playing', singer: 'H', addedBy: 'h' })
    first.store.enqueue({ videoId: VID, title: 'Queued', singer: 'H', addedBy: 'h' })
    const hub = new Hub()
    first.host.startHostLink(code, joinAs(hub, 'host'))
    first.guest.joinSession(code, joinAs(hub, 'g1'))
    await tick()
    expect(mem.get('karaoke.guest')).toContain(code)

    // Reload only the guest side: the old peer vanishes, the host keeps its modules
    hub.peers.get('g1')!.leave()
    vi.resetModules()
    const reloaded = await import('./guest')
    expect(reloaded.getGuest()).toBeNull()
    reloaded.restoreGuest(joinAs(hub, 'g1-new'))
    expect(reloaded.getGuest()!.status).toBe('connecting')
    await tick()

    expect(reloaded.getGuest()!.roomCode).toBe(code)
    expect(reloaded.getGuest()!.status).toBe('live')
    expect(titles(reloaded.getGuest()!.view)).toEqual(['Queued'])
  })

  it('shows waiting when the host drops and goes live again when they return', async () => {
    const { store, host, guest } = await load()
    store.startSession()
    const code = store.getState()!.roomCode
    store.enqueue({ videoId: VID, title: 'Playing', singer: 'H', addedBy: 'h' })
    store.enqueue({ videoId: VID, title: 'Queued', singer: 'H', addedBy: 'h' })
    const hub = new Hub()
    const stop = host.startHostLink(code, joinAs(hub, 'host'))
    guest.joinSession(code, joinAs(hub, 'g1'))
    await tick()
    expect(guest.getGuest()!.status).toBe('live')

    stop()
    await tick()
    expect(guest.getGuest()!.status).toBe('waiting')
    expect(guest.sendCommand({ t: 'add', clientId: 'g1', videoId: VID, title: 'x', singer: 'y' })).toBe(false)

    host.startHostLink(code, joinAs(hub, 'host-2'))
    await tick()
    expect(guest.getGuest()!.status).toBe('live')
    expect(guest.sendCommand({ t: 'add', clientId: 'g1', videoId: VID, title: 'Back', singer: 'y' })).toBe(true)
    await tick()
    expect(titles(store.getState())).toEqual(['Queued', 'Back'])
  })

  it('a refreshed host restores the persisted queue for guests', async () => {
    const before = await load()
    before.store.startSession()
    const code = before.store.getState()!.roomCode
    before.store.enqueue({ videoId: VID, title: 'Playing', singer: 'H', addedBy: 'h' })
    before.store.enqueue({ videoId: VID, title: 'Queued', singer: 'H', addedBy: 'h' })

    const after = await load()
    after.store.hydrate()
    expect(after.store.getState()!.roomCode).toBe(code)

    const hub = new Hub()
    after.host.startHostLink(code, joinAs(hub, 'host'))
    after.guest.joinSession(code, joinAs(hub, 'g1'))
    await tick()
    expect(after.guest.getGuest()!.view!.nowPlaying?.title).toBe('Playing')
    expect(titles(after.guest.getGuest()!.view)).toEqual(['Queued'])
  })
})
