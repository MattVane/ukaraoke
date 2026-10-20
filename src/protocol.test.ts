import { describe, expect, it } from 'vitest'
import { authorize, parseCommand, parseView, type Command } from './protocol'

const VID = 'dQw4w9WgXcQ'
const item = (id: string, addedBy?: string) => ({ id, videoId: VID, title: 'T', singer: 'Ann', addedBy })

describe('parseCommand', () => {
  it('accepts valid commands and trims fields', () => {
    expect(parseCommand({ t: 'add', clientId: 'c1', videoId: VID, title: 'x'.repeat(500), singer: 'y'.repeat(99) })).toMatchObject({
      t: 'add', title: 'x'.repeat(200), singer: 'y'.repeat(30),
    })
    expect(parseCommand({ t: 'remove', clientId: 'c1', id: 'q1' })).toEqual({ t: 'remove', clientId: 'c1', id: 'q1' })
    expect(parseCommand({ t: 'move', clientId: 'c1', id: 'q1', delta: -1 })).toMatchObject({ delta: -1 })
  })

  it.each([
    null, 'x', {}, { t: 'skip', clientId: 'c' },
    { t: 'add', clientId: 'c', videoId: 'short', title: 'T', singer: 'A' },
    { t: 'add', clientId: 'c', videoId: VID, title: '', singer: 'A' },
    { t: 'add', videoId: VID, title: 'T', singer: 'A' },
    { t: 'move', clientId: 'c', id: 'q', delta: 5 },
    { t: 'remove', clientId: 'c' },
  ])('rejects %j', (raw) => {
    expect(parseCommand(raw)).toBeNull()
  })
})

describe('parseView', () => {
  const view = { hostId: 'h', roomCode: 'ABCD', queue: [item('1', 'a')], nowPlaying: item('0', 'b') }

  it('accepts a valid view and rebuilds thumbnails from the video id', () => {
    const v = parseView({ ...view, queue: [{ ...item('1'), thumb: 'https://evil.example/x.png' }] })!
    expect(v.queue[0].thumb).toBe(`https://i.ytimg.com/vi/${VID}/mqdefault.jpg`)
    expect(v.nowPlaying?.id).toBe('0')
  })

  it('allows an empty now-playing', () => {
    expect(parseView({ ...view, nowPlaying: null })!.nowPlaying).toBeNull()
  })

  it('rejects malformed or oversized views', () => {
    expect(parseView(null)).toBeNull()
    expect(parseView({ ...view, queue: 'x' })).toBeNull()
    expect(parseView({ ...view, queue: [{ id: '1' }] })).toBeNull()
    expect(parseView({ ...view, hostId: '' })).toBeNull()
    expect(parseView({ ...view, queue: Array.from({ length: 101 }, (_, i) => item(String(i))) })).toBeNull()
  })
})

describe('authorize', () => {
  const queue = [item('1', 'alice'), item('2', 'bob')]
  const cmd = (c: Partial<Command> & { t: Command['t'] }) => ({ clientId: 'alice', id: '1', delta: 1, ...c }) as Command

  it('lets guests manage only their own songs', () => {
    expect(authorize(cmd({ t: 'remove', id: '1' }), queue)).toBe(true)
    expect(authorize(cmd({ t: 'remove', id: '2' }), queue)).toBe(false)
    expect(authorize(cmd({ t: 'move', id: '2' }), queue)).toBe(false)
    expect(authorize(cmd({ t: 'move', id: 'nope' }), queue)).toBe(false)
  })

  it('caps queue length for adds', () => {
    const full = Array.from({ length: 100 }, (_, i) => item(String(i)))
    expect(authorize(cmd({ t: 'add' }), queue)).toBe(true)
    expect(authorize(cmd({ t: 'add' }), full)).toBe(false)
  })
})
