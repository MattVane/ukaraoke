import { useState } from 'react'
import { joinSession } from './guest'
import { joinCodeFromUrl } from './url'


export function Home({ onStart }: { onStart: () => void }) {
  const [code, setCode] = useState(joinCodeFromUrl() ?? '')
  return (
    <main className="home">
      <div className="home-card">
        <div className="logo">🎤</div>
        <h1>UKaraoke</h1>
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

export function HostElsewhere({ roomCode, onTakeOver }: { roomCode: string; onTakeOver: () => void }) {
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

