import { beforeEach, describe, expect, it } from 'vitest'
import type { JoinFn } from './net'
import { Hub, installLocalStorage, tick } from './test-utils'

const mem = installLocalStorage()
const VID = 'dQw4w9WgXcQ'

describe('host + guest over a fake room', () => {
  beforeEach(() => mem.clear())

  it('syncs the queue, enforces ownership and survives host loss', async () => {
    const { startSession, endSession, getState, enqueue } = await import('./store')
    const { startHostLink } = await import('./host')
    const { joinSession, getGuest, sendCommand, leaveSession } = await import('./guest')

    endSession()
    startSession()
    const code = getState()!.roomCode
    const hub = new Hub()
    const joinAs = (id: string): JoinFn => () => hub.join(id)

    enqueue({ videoId: VID, title: 'Host song', singer: 'Host', addedBy: 'host-client' })
    enqueue({ videoId: VID, title: 'Host song 2', singer: 'Host', addedBy: 'host-client' })
    const stopHost = startHostLink(code, joinAs('host-peer'))

    joinSession(code.toLowerCase(), joinAs('guest-peer'))
    await tick()
    expect(getGuest()!.status).toBe('live')
    expect(getGuest()!.view!.nowPlaying?.title).toBe('Host song')
    expect(getGuest()!.view!.queue).toHaveLength(1)

    sendCommand({ t: 'add', clientId: 'g1', videoId: VID, title: 'Guest song', singer: 'Gus' })
    await tick()
    expect(getState()!.queue.map((q) => q.title)).toEqual(['Host song 2', 'Guest song'])
    expect(getGuest()!.view!.queue).toHaveLength(2)

    const own = getState()!.queue[1].id
    const hosts = getState()!.queue[0].id
    sendCommand({ t: 'remove', clientId: 'g1', id: hosts })
    sendCommand({ t: 'move', clientId: 'g1', id: own, delta: -1 })
    await tick()
    expect(getState()!.queue.map((q) => q.title)).toEqual(['Guest song', 'Host song 2'])

    sendCommand({ t: 'remove', clientId: 'g1', id: own })
    await tick()
    expect(getState()!.queue.map((q) => q.title)).toEqual(['Host song 2'])

    stopHost()
    await tick()
    expect(getGuest()!.status).toBe('waiting')
    expect(sendCommand({ t: 'add', clientId: 'g1', videoId: VID, title: 'x', singer: 'y' })).toBe(false)

    leaveSession()
    expect(getGuest()).toBeNull()
  })

  it('ignores views from a peer that is not the claimed host', async () => {
    const { connectGuest } = await import('./net')
    const hub = new Hub()
    let seen = 0
    connectGuest('ROOM', { onView: () => seen++, onHostLeft: () => {} }, () => hub.join('g'))
    const evil = hub.join('evil')
    const view = evil.room.makeAction('view')
    const bad = { hostId: 'someone-else', roomCode: 'ROOM', queue: [], nowPlaying: null }
    const wrongRoom = { hostId: 'evil', roomCode: 'OTHER', queue: [], nowPlaying: null }
    const good = { hostId: 'evil', roomCode: 'ROOM', queue: [], nowPlaying: null }
    view.send(bad)
    view.send(wrongRoom)
    await tick()
    expect(seen).toBe(0)
    view.send(good)
    await tick()
    expect(seen).toBe(1)
  })
})
