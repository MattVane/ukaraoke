import { describe, expect, it, vi } from 'vitest'
import { acquireHostLock } from './lock'

interface Request {
  steal?: boolean
  signal?: AbortSignal
}

// Just enough of LockManager: one exclusive lock with queueing, abort signals and steal
class FakeLocks {
  private holder: { abort: (e: unknown) => void } | null = null
  private waiters: (() => void)[] = []

  request(_name: string, options: Request, cb: (l: object) => unknown) {
    return new Promise<void>((resolve, reject) => {
      const grant = () => {
        const held = Promise.resolve(cb({}))
        const me = { abort: (e: unknown) => ((this.holder = null), reject(e)) }
        this.holder = me
        held.then(() => {
          if (this.holder === me) this.holder = null
          resolve()
          this.waiters.shift()?.()
        })
      }
      if (!this.holder) return grant()
      if (options.steal) {
        this.holder.abort(new DOMException('stolen', 'AbortError'))
        return grant()
      }
      this.waiters.push(grant)
      options.signal?.addEventListener('abort', () => {
        this.waiters = this.waiters.filter((w) => w !== grant)
        reject(new DOMException('aborted', 'AbortError'))
      })
    })
  }
}

const asLocks = (l: FakeLocks) => l as unknown as Parameters<typeof acquireHostLock>[1]
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('host tab lock', () => {
  it('lets only one tab host at a time', async () => {
    const locks = new FakeLocks()
    const first = await acquireHostLock({ onLost: vi.fn() }, asLocks(locks))
    const second = await acquireHostLock({ waitMs: 20, onLost: vi.fn() }, asLocks(locks))
    expect(first).not.toBeNull()
    expect(second).toBeNull()
  })

  it('frees the lock when the host releases it', async () => {
    const locks = new FakeLocks()
    const first = await acquireHostLock({ onLost: vi.fn() }, asLocks(locks))
    first!.release()
    await wait(5)
    expect(await acquireHostLock({ waitMs: 20, onLost: vi.fn() }, asLocks(locks))).not.toBeNull()
  })

  it('waits briefly for a lock that is being released, like a re-run effect', async () => {
    const locks = new FakeLocks()
    const first = await acquireHostLock({ onLost: vi.fn() }, asLocks(locks))
    const pending = acquireHostLock({ waitMs: 500, onLost: vi.fn() }, asLocks(locks))
    await wait(10)
    first!.release()
    expect(await pending).not.toBeNull()
  })

  it('lets another tab take over and tells the old host it lost the lock', async () => {
    const locks = new FakeLocks()
    const lost = vi.fn()
    await acquireHostLock({ onLost: lost }, asLocks(locks))
    const stolen = await acquireHostLock({ steal: true, onLost: vi.fn() }, asLocks(locks))
    await wait(5)
    expect(stolen).not.toBeNull()
    expect(lost).toHaveBeenCalledOnce()
  })

  it('does not report a lost lock when it simply timed out waiting', async () => {
    const locks = new FakeLocks()
    await acquireHostLock({ onLost: vi.fn() }, asLocks(locks))
    const lost = vi.fn()
    expect(await acquireHostLock({ waitMs: 10, onLost: lost }, asLocks(locks))).toBeNull()
    await wait(5)
    expect(lost).not.toHaveBeenCalled()
  })
})
