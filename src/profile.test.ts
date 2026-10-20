import { beforeEach, describe, expect, it } from 'vitest'
import { NAME_KEY, SECRET_KEY, deriveClientId, getName, getSecret, setName } from './profile'

const mem = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  },
})

beforeEach(() => mem.clear())

describe('profile', () => {
  it('is empty until a name is set', () => {
    expect(getName()).toBe('')
  })

  it('trims, persists and caps the name', () => {
    setName('  Ann  ')
    expect(mem.get(NAME_KEY)).toBe('Ann')
    setName('x'.repeat(50))
    expect(getName()).toHaveLength(30)
  })

  it('ignores blank names', () => {
    setName('Ann')
    setName('   ')
    expect(getName()).toBe('Ann')
  })

  it('keeps one private secret per device and derives a different public ID', async () => {
    const s = getSecret()
    expect(s.length).toBeGreaterThanOrEqual(32)
    expect(getSecret()).toBe(s)
    expect(mem.get(SECRET_KEY)).toBe(s)
    const id = await deriveClientId(s)
    expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(id).not.toContain(s.slice(0, 8))
    expect(await deriveClientId(s)).toBe(id)
    expect(await deriveClientId(s + 'x')).not.toBe(id)
  })
})
