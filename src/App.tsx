import { useState } from 'react'
import { Player } from './Player'
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

// Placeholder results until the search feature lands
const MOCK_RESULTS = [
  { videoId: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up (Karaoke Version)' },
  { videoId: 'fJ9rUzIMcZQ', title: 'Bohemian Rhapsody (Karaoke Version)' },
  { videoId: 'hTWKbfoikeg', title: 'Smells Like Teen Spirit (Karaoke Version)' },
  { videoId: '1w7OgIMMRc4', title: "Sweet Child O' Mine (Karaoke Version)" },
]

export default function App() {
  const session = useSession()
  const [tab, setTab] = useState<Tab>('stage')
  // Autoplay needs a user gesture, so a restored session waits for a click
  const [resumed, setResumed] = useState(false)
  const [sideOpen, setSideOpen] = useState(true)

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

  const add = (r: { videoId: string; title: string }, singer: string) => {
    addToQueue({ ...r, thumb: `https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg`, singer })
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
          className="btn icon side-toggle"
          onClick={() => setSideOpen((o) => !o)}
          aria-label={sideOpen ? 'Hide side panel' : 'Show side panel'}
          aria-expanded={sideOpen}
          title={sideOpen ? 'Hide side panel' : 'Show side panel'}
        >
          {sideOpen ? '»' : '«'}
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
                <button className="btn primary" onClick={() => setTab('search')}>Find a song</button>
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

        <section className="panel search">
          <h2>Search</h2>
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

function SearchPanel({ onAdd }: { onAdd: (r: { videoId: string; title: string }, singer: string) => void }) {
  const [q, setQ] = useState('')
  const [singer, setSinger] = useState('')
  const results = q.trim() ? MOCK_RESULTS : []
  return (
    <>
      <div className="fields">
        <input className="input" type="search" placeholder="Search karaoke songs…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input" placeholder="Your name" value={singer} onChange={(e) => setSinger(e.target.value)} />
      </div>
      {!q.trim() && <p className="muted">Type a song or artist. “karaoke” is added automatically.</p>}
      <ul className="list">
        {results.map((r) => (
          <li className="row" key={r.videoId}>
            <img src={`https://i.ytimg.com/vi/${r.videoId}/mqdefault.jpg`} alt="" />
            <div className="row-text">
              <div className="row-title">{r.title}</div>
            </div>
            <button className="btn primary small" onClick={() => onAdd(r, singer.trim() || 'Guest')}>+ Add</button>
          </li>
        ))}
      </ul>
    </>
  )
}
