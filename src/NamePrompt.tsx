import { useState } from 'react'
import { setName } from './profile'

export function NamePrompt({ initial, onDone }: { initial: string; onDone: () => void }) {
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

