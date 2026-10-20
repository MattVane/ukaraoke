import { useEffect, useState } from 'react'
import { leaveSession, joinSession, sendCommand, useGuest } from './guest'
import { startHostLink } from './host'
import { Home, HostElsewhere } from './Home'
import { useHostLock } from './lock'
import { NamePrompt } from './NamePrompt'
import { dismissNotice, useNotice } from './unplayable'
import { Player } from './Player'
import { getClientId, getSecret, useName } from './profile'
import { thumbFor } from './protocol'
import { QueueRow } from './QueueRow'
import { SearchPanel } from './SearchPanel'
import { JoinCard, ShareDialog } from './Share'
import type { SearchResult } from './search'
import {
  endSession, enqueue, getState, moveInQueue, playNext, removeFromQueue, startSession, useSession,
  type QueueItem,
} from './store'
import { joinCodeFromUrl } from './url'
import './App.css'

type Tab = 'stage' | 'search' | 'queue'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'stage', label: 'Now playing', icon: '▶' },
  { id: 'search', label: 'Search', icon: '⌕' },
  { id: 'queue', label: 'Queue', icon: '☰' },
]

export default function App() {
  const session = useSession()
  const guest = useGuest()
  const name = useName()
  const skipped = useNotice()
  const [tab, setTab] = useState<Tab>('stage')
  // Autoplay needs a user gesture, so a restored session waits for a click
  const [resumed, setResumed] = useState(false)
  const [sideOpen, setSideOpen] = useState(() => localStorage.getItem('ukaraoke.sideOpen') !== 'false')
  const [editingName, setEditingName] = useState(false)
  const [sharing, setSharing] = useState(false)
  const toggleSide = () => {
    setSideOpen((o) => {
      localStorage.setItem('ukaraoke.sideOpen', String(!o))
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
  const secret = getSecret()
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
      sendCommand({ t: 'add', secret, videoId: r.videoId, title: r.title, singer: name })
    }
  }
  const canManage = (q: QueueItem) => isHost || q.addedBy === clientId
  const move = (id: string, delta: -1 | 1) =>
    isHost ? moveInQueue(id, delta) : sendCommand({ t: 'move', secret, id, delta })
  const remove = (id: string) => (isHost ? removeFromQueue(id) : sendCommand({ t: 'remove', secret, id }))
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
        <div className="brand">🎤 <span>UKaraoke</span></div>
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
            <span aria-hidden>⧉</span>
            <span className="label">Room</span>
            <strong>{roomCode}</strong>
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
              <Player key={session.nowPlaying.item.id} item={session.nowPlaying.item} startSeconds={session.nowPlaying.positionSec} />
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

