import { describe, expect, it, vi } from 'vitest'
import { buildQuery, filterEmbeddable, formatDuration, parseResults, searchKaraoke } from './search'

const item = (id: string, extra = {}) => ({
  url: `/watch?v=${id}`, type: 'stream', title: `T ${id}`, uploaderName: 'Sing King', duration: 375, ...extra,
})
const ok = (items: unknown[]) => ({ ok: true, status: 200, json: async () => ({ items }) }) as Response
const bad = (status: number) => ({ ok: false, status, json: async () => ({}) }) as Response

describe('parseResults', () => {
  it('keeps videos, drops shorts, channels and malformed entries', () => {
    const r = parseResults({
      items: [
        item('9Lxm0iSnKNc'),
        item('xyF04rAhHaQ', { isShort: true }),
        item('abcdefghijk', { type: 'channel' }),
        { type: 'stream', title: 'no url' },
      ],
    })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ videoId: '9Lxm0iSnKNc', channel: 'Sing King', durationSec: 375 })
    expect(r[0].thumb).toContain('i.ytimg.com/vi/9Lxm0iSnKNc')
  })

  it('throws on an unexpected shape', () => {
    expect(() => parseResults({})).toThrow()
  })
})

describe('buildQuery', () => {
  it('appends karaoke once', () => {
    expect(buildQuery(' queen ')).toBe('queen karaoke')
    expect(buildQuery('queen Karaoke')).toBe('queen Karaoke')
  })
})

describe('searchKaraoke', () => {
  it('falls back to the next instance on failure', async () => {
    const f = vi.fn().mockResolvedValueOnce(bad(502)).mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(ok([item('9Lxm0iSnKNc')]))
    const r = await searchKaraoke('queen', { instances: ['https://a', 'https://b', 'https://c'], fetchFn: f, embeddableOnly: false })
    expect(r).toHaveLength(1)
    expect(f).toHaveBeenCalledTimes(3)
    expect(f.mock.calls[0][0]).toBe('https://a/search?q=queen%20karaoke&filter=videos')
  })

  it('throws when every instance fails', async () => {
    const f = vi.fn().mockResolvedValue(bad(500))
    await expect(searchKaraoke('x', { instances: ['https://a', 'https://b'], fetchFn: f, embeddableOnly: false })).rejects.toThrow('500')
  })

  it('stops when aborted', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const f = vi.fn()
    await expect(searchKaraoke('x', { instances: ['https://a'], fetchFn: f, signal: ctrl.signal, embeddableOnly: false })).rejects.toThrow()
    expect(f).not.toHaveBeenCalled()
  })
})

describe('filterEmbeddable', () => {
  const r = (id: string) => ({ videoId: id, title: id, thumb: '', channel: '', durationSec: 1 })

  it('drops videos that block embedding and keeps the rest', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.includes('blocked')) return bad(401)
      if (url.includes('flaky')) throw new Error('net')
      return ok([])
    })
    const out = await filterEmbeddable([r('good'), r('blocked'), r('flaky')], f as unknown as typeof fetch)
    expect(out.map((x) => x.videoId)).toEqual(['good', 'flaky'])
  })

  it('is applied by searchKaraoke by default', async () => {
    const f = vi.fn(async (url: string) =>
      url.includes('oembed') ? (url.includes('xyF04rAhHaQ') ? bad(401) : ok([])) : ok([item('9Lxm0iSnKNc'), item('xyF04rAhHaQ')]),
    )
    const out = await searchKaraoke('queen', { instances: ['https://a'], fetchFn: f as unknown as typeof fetch })
    expect(out.map((x) => x.videoId)).toEqual(['9Lxm0iSnKNc'])
  })
})

describe('formatDuration', () => {
  it('formats m:ss', () => {
    expect(formatDuration(375)).toBe('6:15')
    expect(formatDuration(0)).toBe('')
  })
})
