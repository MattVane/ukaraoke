import { useEffect, useState } from 'react'
import { probeEmbeddable } from './probe'
import { formatDuration, searchKaraoke, type SearchResult } from './search'
import { useBlocked } from './unplayable'

export function SearchPanel({ onAdd, disabled }: { onAdd: (r: SearchResult) => void; disabled?: boolean }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('done')
  const [added, setAdded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) return
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => {
      setStatus('loading')
      searchKaraoke(query, { signal: ctrl.signal })
        .then((r) => { setResults(r); setStatus('done') })
        .catch((e) => { if (!ctrl.signal.aborted) { console.error(e); setStatus('error') } })
    }, 400)
    return () => { window.clearTimeout(timer); ctrl.abort() }
  }, [q])

  const idle = q.trim().length < 2
  const blocked = useBlocked()
  const shown = idle ? [] : results

  const probe = async (r: SearchResult) => {
    if (blocked.includes(r.videoId)) return false
    setChecking((s) => new Set(s).add(r.videoId))
    const ok = await probeEmbeddable(r.videoId)
    setChecking((s) => { const n = new Set(s); n.delete(r.videoId); return n })
    return ok
  }

  const [checking, setChecking] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())

  const add = async (r: SearchResult) => {
    setPending((s) => new Set(s).add(r.videoId))
    const ok = await probe(r)
    setPending((s) => { const n = new Set(s); n.delete(r.videoId); return n })
    if (!ok) return
    onAdd(r)
    setAdded((s) => new Set(s).add(r.videoId))
    window.setTimeout(() => setAdded((s) => { const n = new Set(s); n.delete(r.videoId); return n }), 2000)
  }

  return (
    <>
      <div className="fields">
        <input className="input" type="search" placeholder="Search karaoke songs…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {idle && <p className="muted">Type a song or artist.</p>}
      {!idle && status === 'loading' && <p className="muted">Searching…</p>}
      {!idle && status === 'error' && <p className="muted error">Search is unavailable right now. Try again in a moment.</p>}
      {!idle && status === 'done' && results.length === 0 && <p className="muted">No results.</p>}
      <ul className="list">
        {shown.map((r) => {
          const isBlocked = blocked.includes(r.videoId)
          const isChecking = checking.has(r.videoId)
          return (
          <li className={`row${isBlocked ? ' blocked' : ''}`} key={r.videoId} onPointerEnter={() => void probe(r)}>
            <img src={r.thumb} alt="" />
            <div className="row-text">
              <div className="row-title">{r.title}</div>
              <div className="row-sub">
                {isBlocked ? 'Can’t be embedded' : isChecking ? 'Checking…' : [r.channel, formatDuration(r.durationSec)].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button className="btn primary icon" aria-label={isBlocked ? 'Unavailable' : 'Add'} disabled={disabled || isBlocked || added.has(r.videoId) || pending.has(r.videoId)} onClick={() => void add(r)}>
              {isBlocked ? '⊘' : added.has(r.videoId) ? '✓' : isChecking ? <span className="spinner" /> : '+'}
            </button>
          </li>
          )
        })}
      </ul>
    </>
  )
}
