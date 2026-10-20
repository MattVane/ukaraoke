import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { leaveSession, joinSession, sendCommand, useGuest } from './guest'
import { startHostLink } from './host'
import { useHostLock } from './lock'
import { dismissNotice, useBlocked, useNotice } from './unplayable'
import { probeEmbeddable } from './probe'
import { Player } from './Player'
import { getClientId, setName, useName } from './profile'
import { thumbFor } from './protocol'
import { formatDuration, searchKaraoke, type SearchResult } from './search'
import {
  endSession, enqueue, getState, moveInQueue, playNext, removeFromQueue, startSession, useSession,
  type QueueItem,
} from './store'
import './App.css'

type Tab = 'stage' | 'search' | 'queue'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'stage', label: 'Now playing', icon: '▶' },
  { id: 'search', label: 'Search', icon: '⌕' },
  { id: 'queue', label: 'Queue', icon: '☰' },
]

function joinCodeFromUrl() {
  return new URLSearchParams(location.search).get('join')
}

export default function App() {
  const session = useSession()
  const guest = useGuest()
  const name = useName()
  const skipped = useNotice()
  const [tab, setTab] = useState<Tab>('stage')
  // Autoplay needs a user gesture, so a restored session waits for a click
  const [resumed, setResumed] = useState(false)
  const [sideOpen, setSideOpen] = useState(() => localStorage.getItem('karaoke.sideOpen') !== 'false')
  const [editingName, setEditingName] = useState(false)
  const [sharing, setSharing] = useState(false)
  const toggleSide = () => {
    setSideOpen((o) => {
      localStorage.setItem('karaoke.sideOpen', String(!o))
      return !o
    })
  }

  const hostRoom = session?.roomCode
  const hostLock = useHostLock(hostRoom)
  const hosting = hostLock.status === 'held'
  useEffect(() => {
    if (!hostRoom || !hosting) return
    return startHostLink(hostRoom)
  }, [hostRoom, hosting])

  // Opening a shared link (?join=CODE) joins that room
  useEffect(() => {
    const code = joinCodeFromUrl()
    if (!code) return
    history.replaceState(null, '', location.pathname)
    if (!getHostSession()) joinSession(code)
  }, [])

  if (!session && !guest) {
    return <Home onStart={() => { startSession(); setResumed(true) }} />
  }

  if (session && hostLock.status !== 'held') {
    // Never mount the player until we know no other tab is already hosting
    if (hostLock.status === 'blocked') return <HostElsewhere roomCode={session.roomCode} onTakeOver={hostLock.takeOver} />
    return null
  }

  if (!name || editingName) {
    return <NamePrompt initial={name} onDone={() => setEditingName(false)} />
  }

  const isHost = !!session
  const clientId = getClientId()
  const roomCode = session?.roomCode ?? guest!.roomCode
  const queue = isHost ? session.queue : (guest!.view?.queue ?? [])
  const nowPlaying = isHost ? (session.nowPlaying?.item ?? null) : (guest!.view?.nowPlaying ?? null)
  const waiting = !isHost && guest!.status !== 'live'

  const add = (r: SearchResult) => {
    if (isHost) {
      enqueue({ videoId: r.videoId, title: r.title, thumb: r.thumb, singer: name, addedBy: clientId })
      setResumed(true)
    } else {
      sendCommand({ t: 'add', clientId, videoId: r.videoId, title: r.title, singer: name })
    }
  }
  const canManage = (q: QueueItem) => isHost || q.addedBy === clientId
  const move = (id: string, delta: -1 | 1) =>
    isHost ? moveInQueue(id, delta) : sendCommand({ t: 'move', clientId, id, delta })
  const remove = (id: string) => (isHost ? removeFromQueue(id) : sendCommand({ t: 'remove', clientId, id }))
  const exit = () => {
    if (!confirm(isHost ? 'End this session?' : 'Leave this session?')) return
    if (isHost) endSession()
    else leaveSession()
  }

  const nowPlayingBlock = nowPlaying && (
    <div className="np">
      <div className="np-text">
        <div className="np-title">{nowPlaying.title}</div>
        <div className="np-sub">Singing: {nowPlaying.singer}</div>
      </div>
      {isHost && <button className="btn icon" onClick={playNext} aria-label="Skip">⏭</button>}
    </div>
  )
  const upNextBlock = queue[0] && (
    <div className="upnext"><span>Up next: <strong>{queue[0].singer}</strong> – {queue[0].title}</span></div>
  )

  return (
    <div className="app" data-tab={tab}>
      <header className="topbar">
        <div className="brand">🎤 <span>Karaoke</span></div>
        <button
          className="btn icon"
          onClick={() => setEditingName(true)}
          aria-label="Change name"
          title={`Signed in as ${name}. Change name`}
        >
          ✎
        </button>
        <div className="room">
          <button className="room-main" onClick={() => setSharing(true)} title="Invite others">
            <span className="label">Room</span>
            <strong>{roomCode}</strong>
            <span aria-hidden>⧉</span>
          </button>
          <button
            className="room-exit"
            onClick={exit}
            aria-label={isHost ? 'End session' : 'Leave session'}
            title={isHost ? 'End session' : 'Leave session'}
          >
            ✕
          </button>
        </div>
      </header>

      {isHost && skipped && (
        <div className="banner warn" role="status">
          <span>Skipped “{skipped.title}”: {skipped.reason}.</span>
          <button className="banner-close" onClick={dismissNotice} aria-label="Dismiss">✕</button>
        </div>
      )}

      {waiting && (
        <div className="banner">
          {guest!.status === 'connecting' ? `Connecting to room ${roomCode}…` : 'Host disconnected. Waiting for them to come back…'}
        </div>
      )}

      <main className={`panels${sideOpen ? '' : ' side-collapsed'}`}>
        <section className={`panel stage${isHost ? ' host' : ''}`}>
          <div className="screen">
            {isHost && session.nowPlaying && resumed ? (
              <Player item={session.nowPlaying.item} startSeconds={session.nowPlaying.positionSec} />
            ) : isHost && session.nowPlaying ? (
              <button className="btn primary big" onClick={() => setResumed(true)}>
                ▶ Resume session
              </button>
            ) : nowPlaying ? (
              <img className="np-thumb" src={thumbFor(nowPlaying.videoId)} alt="" />
            ) : (
              <div className="empty">
                <div className="logo">🎶</div>
                <p>Nothing playing yet</p>
              </div>
            )}
          </div>
          {!isHost && nowPlayingBlock}
          {!isHost && upNextBlock}
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
            <SearchPanel onAdd={add} disabled={waiting} />
          </section>

          <section className="panel queue">
            <h2>Queue <span className="count">{queue.length}</span></h2>
            {queue.length === 0 ? (
              <p className="muted">The queue is empty.</p>
            ) : (
              <ol className="list">
                {queue.map((q, i) => (
                  <QueueRow
                    key={q.id}
                    item={q}
                    first={i === 0}
                    last={i === queue.length - 1}
                    manage={canManage(q)}
                    onMove={(d) => move(q.id, d)}
                    onRemove={() => remove(q.id)}
                  />
                ))}
              </ol>
            )}
          </section>
        </aside>
      </main>

      {isHost && (
        <footer className="statusbar">
          <div className="statusbar-np">{nowPlayingBlock}</div>
          <div className="statusbar-next">{upNextBlock}</div>
          <JoinCard roomCode={roomCode} />
        </footer>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="ti">{t.icon}</span>
            {t.label}
            {t.id === 'queue' && queue.length > 0 && <span className="badge">{queue.length}</span>}
          </button>
        ))}
      </nav>

      {sharing && <ShareDialog roomCode={roomCode} onClose={() => setSharing(false)} />}
    </div>
  )
}

function getHostSession() {
  return getState()
}

function Home({ onStart }: { onStart: () => void }) {
  const [code, setCode] = useState(joinCodeFromUrl() ?? '')
  return (
    <main className="home">
      <div className="home-card">
        <div className="logo">🎤</div>
        <h1>Karaoke</h1>
        <p>Queue up videos from YouTube and sing along with friends.</p>
        <button className="btn primary big" onClick={onStart}>Start new session</button>
        <div className="or">or join one</div>
        <form
          className="join"
          onSubmit={(e) => {
            e.preventDefault()
            joinSession(code)
          }}
        >
          <input
            className="input code"
            placeholder="Room code"
            maxLength={8}
            autoCapitalize="characters"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn" disabled={code.trim().length < 3}>Join</button>
        </form>
      </div>
    </main>
  )
}

function HostElsewhere({ roomCode, onTakeOver }: { roomCode: string; onTakeOver: () => void }) {
  return (
    <main className="home">
      <div className="home-card">
        <div className="logo">🪟</div>
        <h1>Room {roomCode}</h1>
        <p>This session is already open in another tab.</p>
        <button className="btn primary big" onClick={onTakeOver}>Use this tab instead</button>
      </div>
    </main>
  )
}

function joinUrl(roomCode: string) {
  return `${location.origin}${location.pathname}?join=${roomCode}`
}

function useQr(url: string, width: number) {
  const [qr, setQr] = useState('')
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width }).then(setQr, () => setQr(''))
  }, [url, width])
  return qr
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard needs a secure context; the link is shown for manual copying
    }
  }
  return { copied, copy }
}

// Always-on invite shown under the player so nobody has to open a dialog mid-song
function JoinCard({ roomCode }: { roomCode: string }) {
  const url = joinUrl(roomCode)
  const qr = useQr(url, 160)
  const { copied, copy } = useCopy(url)
  return (
    <div className="joincard">
      {qr && <img className="qr small" src={qr} alt={`QR code to join room ${roomCode}`} />}
      <div className="joincard-text">
        <div className="joincard-title">Join the session</div>
        <div className="joincard-url">{url.replace(/^https?:\/\//, '')}</div>
        <div className="joincard-code">Room <strong>{roomCode}</strong></div>
      </div>
      <button className="btn icon" onClick={copy} aria-label="Copy join link" title="Copy join link">
        {copied ? '✓' : '⧉'}
      </button>
    </div>
  )
}

function ShareDialog({ roomCode, onClose }: { roomCode: string; onClose: () => void }) {
  const url = joinUrl(roomCode)
  const qr = useQr(url, 240)
  const { copied, copy } = useCopy(url)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Invite others" onClick={(e) => e.stopPropagation()}>
        <h2>Join this session</h2>
        {qr && <img className="qr" src={qr} alt={`QR code to join room ${roomCode}`} />}
        <div className="code-big">{roomCode}</div>
        <p className="muted url">{url}</p>
        <div className="modal-actions">
          <button className="btn" onClick={copy}>{copied ? '✓ Copied' : 'Copy link'}</button>
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
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

function QueueRow({ item, first, last, manage, onMove, onRemove }: {
  item: QueueItem
  first: boolean
  last: boolean
  manage: boolean
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}) {
  return (
    <li className="row">
      <img src={item.thumb ?? thumbFor(item.videoId)} alt="" />
      <div className="row-text">
        <div className="row-title">{item.title}</div>
        <div className="row-sub">{item.singer}</div>
      </div>
      {manage && (
        <div className="row-actions">
          <button className="btn icon" disabled={first} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
          <button className="btn icon" disabled={last} onClick={() => onMove(1)} aria-label="Move down">↓</button>
          <button className="btn icon danger" onClick={onRemove} aria-label="Remove">✕</button>
        </div>
      )}
    </li>
  )
}

function SearchPanel({ onAdd, disabled }: { onAdd: (r: SearchResult) => void; disabled?: boolean }) {
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
  const visible = results.filter((r) => !blocked.includes(r.videoId))
  const shown = idle ? [] : visible

  const [checking, setChecking] = useState<Set<string>>(new Set())

  const add = async (r: SearchResult) => {
    setChecking((s) => new Set(s).add(r.videoId))
    const ok = await probeEmbeddable(r.videoId)
    setChecking((s) => { const n = new Set(s); n.delete(r.videoId); return n })
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
      {!idle && status === 'done' && visible.length === 0 && <p className="muted">No results.</p>}
      <ul className="list">
        {shown.map((r) => (
          <li className="row" key={r.videoId} onPointerEnter={() => void probeEmbeddable(r.videoId)}>
            <img src={r.thumb} alt="" />
            <div className="row-text">
              <div className="row-title">{r.title}</div>
              <div className="row-sub">{[r.channel, formatDuration(r.durationSec)].filter(Boolean).join(' · ')}</div>
            </div>
            <button className="btn primary icon" aria-label="Add" disabled={disabled || added.has(r.videoId) || checking.has(r.videoId)} onClick={() => void add(r)}>
              {added.has(r.videoId) ? '✓' : checking.has(r.videoId) ? '…' : '+'}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
