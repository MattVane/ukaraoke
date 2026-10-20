import { useEffect, useState } from 'react'
import { Player } from './Player'
import { setName, useName } from './profile'
import { formatDuration, searchKaraoke, type SearchResult } from './search'
import {
  addToQueue, endSession, moveInQueue, playNext, removeFromQueue, startSession, useSession,
  type QueueItem,
} from './store'
import './App.css'

type Tab = 'stage' | 'search' | 'queue'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'stage', label: 'Now playing', icon: '▶' },
  { id: 'search', label: 'Search', icon: '⌕' },
  { id: 'queue', label: 'Queue', icon: '☰' },
]

export default function App() {
  const session = useSession()
  const name = useName()
  const [tab, setTab] = useState<Tab>('stage')
  // Autoplay needs a user gesture, so a restored session waits for a click
  const [resumed, setResumed] = useState(false)
  const [sideOpen, setSideOpen] = useState(() => localStorage.getItem('karaoke.sideOpen') !== 'false')
  const [editingName, setEditingName] = useState(false)
  const toggleSide = () => {
    setSideOpen((o) => {
      localStorage.setItem('karaoke.sideOpen', String(!o))
      return !o
    })
  }

  if (!session) {
    return (
      <main className="home">
        <div className="home-card">
          <div className="logo">🎤</div>
          <h1>Karaoke</h1>
          <p>Queue up videos from YouTube and sing along with friends.</p>
          <button className="btn primary big" onClick={() => { startSession(); setResumed(true) }}>
            Start new session
          </button>
          <button className="btn ghost" disabled>Join a session</button>
        </div>
      </main>
    )
  }

  const { nowPlaying, queue, roomCode } = session

  if (!name || editingName) {
    return <NamePrompt initial={name} onDone={() => setEditingName(false)} />
  }
  const add = (r: SearchResult) => {
    addToQueue({ videoId: r.videoId, title: r.title, thumb: r.thumb, singer: name })
    if (!nowPlaying) { playNext(); setResumed(true) }
  }

  return (
    <div className="app" data-tab={tab}>
      <header className="topbar">
        <div className="brand">🎤 <span>Karaoke</span></div>
        <div className="room" title="Share this code to join">
          <span className="label">Room</span>
          <strong>{roomCode}</strong>
        </div>
        <button
          className="btn icon"
          onClick={() => setEditingName(true)}
          aria-label="Change name"
          title={`Signed in as ${name}. Change name`}
        >
          ✎
        </button>
        <button
          className="btn icon"
          onClick={() => { if (confirm('End this session?')) endSession() }}
          aria-label="End session"
          title="End session"
        >
          ✕
        </button>
      </header>

      <main className={`panels${sideOpen ? '' : ' side-collapsed'}`}>
        <section className="panel stage">
          <div className="screen">
            {nowPlaying && resumed ? (
              <Player item={nowPlaying.item} startSeconds={nowPlaying.positionSec} />
            ) : nowPlaying ? (
              <button className="btn primary big" onClick={() => setResumed(true)}>
                ▶ Resume session
              </button>
            ) : (
              <div className="empty">
                <div className="logo">🎶</div>
                <p>Nothing playing yet</p>
              </div>
            )}
          </div>
          {nowPlaying && (
            <div className="np">
              <div className="np-text">
                <div className="np-title">{nowPlaying.item.title}</div>
                <div className="np-sub">Singing: {nowPlaying.item.singer}</div>
              </div>
              <button className="btn icon" onClick={playNext} aria-label="Skip">⏭</button>
            </div>
          )}
          {queue[0] && <div className="upnext">Up next: <strong>{queue[0].singer}</strong> – {queue[0].title}</div>}
        </section>

        <aside className="sidebar">
          <div className="sidebar-head">
            <button
              className="btn icon side-toggle"
              onClick={toggleSide}
              aria-label={sideOpen ? 'Hide side panel' : 'Show side panel'}
              aria-expanded={sideOpen}
              title={sideOpen ? 'Hide side panel' : 'Show side panel'}
            >
              {sideOpen ? '»' : '«'}
            </button>
            <h2>Search</h2>
          </div>

          <section className="panel search">
            <SearchPanel onAdd={add} />
          </section>

          <section className="panel queue">
            <h2>Queue <span className="count">{queue.length}</span></h2>
            {queue.length === 0 ? (
              <p className="muted">The queue is empty.</p>
            ) : (
              <ol className="list">
                {queue.map((q, i) => (
                  <QueueRow key={q.id} item={q} first={i === 0} last={i === queue.length - 1} />
                ))}
              </ol>
            )}
          </section>
        </aside>
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="ti">{t.icon}</span>
            {t.label}
            {t.id === 'queue' && queue.length > 0 && <span className="badge">{queue.length}</span>}
          </button>
        ))}
      </nav>
    </div>
  )
}

function NamePrompt({ initial, onDone }: { initial: string; onDone: () => void }) {
  const [value, setValue] = useState(initial)
  const editing = initial !== ''
  return (
    <main className="home">
      <form
        className="home-card"
        onSubmit={(e) => {
          e.preventDefault()
          setName(value)
          onDone()
        }}
      >
        <div className="logo">👋</div>
        <h1>{editing ? 'Change your name' : "Who's singing?"}</h1>
        <p>Your name appears next to the songs you add.</p>
        <input
          className="input"
          autoFocus
          required
          maxLength={30}
          placeholder="Your name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn primary big" disabled={!value.trim()}>{editing ? 'Save' : 'Continue'}</button>
        {editing && <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>}
      </form>
    </main>
  )
}

function QueueRow({ item, first, last }: { item: QueueItem; first: boolean; last: boolean }) {
  return (
    <li className="row">
      <img src={item.thumb ?? `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`} alt="" />
      <div className="row-text">
        <div className="row-title">{item.title}</div>
        <div className="row-sub">{item.singer}</div>
      </div>
      <div className="row-actions">
        <button className="btn icon" disabled={first} onClick={() => moveInQueue(item.id, -1)} aria-label="Move up">↑</button>
        <button className="btn icon" disabled={last} onClick={() => moveInQueue(item.id, 1)} aria-label="Move down">↓</button>
        <button className="btn icon danger" onClick={() => removeFromQueue(item.id)} aria-label="Remove">✕</button>
      </div>
    </li>
  )
}

function SearchPanel({ onAdd }: { onAdd: (r: SearchResult) => void }) {
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
  const shown = idle ? [] : results

  const add = (r: SearchResult) => {
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
        {shown.map((r) => (
          <li className="row" key={r.videoId}>
            <img src={r.thumb} alt="" />
            <div className="row-text">
              <div className="row-title">{r.title}</div>
              <div className="row-sub">{[r.channel, formatDuration(r.durationSec)].filter(Boolean).join(' · ')}</div>
            </div>
            <button className="btn primary small" disabled={added.has(r.videoId)} onClick={() => add(r)}>
              {added.has(r.videoId) ? '✓ Added' : '+ Add'}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
