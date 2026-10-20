import { useState } from 'react'
import { Player } from './Player'
import {
  addToQueue, endSession, moveInQueue, playNext, removeFromQueue, startSession, useSession,
} from './store'
import './App.css'

export default function App() {
  const session = useSession()
  // Autoplay needs a user gesture, so a restored session waits for a click
  const [resumed, setResumed] = useState(false)

  if (!session) {
    return (
      <main className="home">
        <h1>Karaoke</h1>
        <button onClick={() => { startSession(); setResumed(true) }}>Start new session</button>
      </main>
    )
  }

  const { nowPlaying, queue, roomCode } = session

  return (
    <main className="session">
      <header>
        <span>Room <strong>{roomCode}</strong></span>
        <button onClick={playNext}>Skip</button>
        <button onClick={endSession}>End session</button>
      </header>

      <section className="stage">
        {nowPlaying && resumed ? (
          <Player item={nowPlaying.item} startSeconds={nowPlaying.positionSec} />
        ) : nowPlaying ? (
          <button onClick={() => setResumed(true)}>
            Resume “{nowPlaying.item.title}” at {nowPlaying.positionSec}s
          </button>
        ) : (
          <p>Nothing playing. Add a song to the queue.</p>
        )}
        {nowPlaying && <p>Now singing: {nowPlaying.item.singer} – {nowPlaying.item.title}</p>}
      </section>

      <section className="queue">
        <h2>Queue</h2>
        <AddForm onAdded={() => { if (!nowPlaying) { playNext(); setResumed(true) } }} />
        <ol>
          {queue.map((q) => (
            <li key={q.id}>
              {q.singer} – {q.title}
              <button onClick={() => moveInQueue(q.id, -1)}>↑</button>
              <button onClick={() => moveInQueue(q.id, 1)}>↓</button>
              <button onClick={() => removeFromQueue(q.id)}>✕</button>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

// Temporary manual entry until the search feature lands
function AddForm({ onAdded }: { onAdded: () => void }) {
  const [videoId, setVideoId] = useState('')
  const [title, setTitle] = useState('')
  const [singer, setSinger] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        addToQueue({ videoId: videoId.trim(), title: title.trim() || videoId.trim(), singer: singer.trim() || 'Guest' })
        setVideoId(''); setTitle('')
        onAdded()
      }}
    >
      <input required placeholder="YouTube video ID" value={videoId} onChange={(e) => setVideoId(e.target.value)} />
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Singer" value={singer} onChange={(e) => setSinger(e.target.value)} />
      <button>Add</button>
    </form>
  )
}
