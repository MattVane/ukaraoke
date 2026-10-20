import { connectHost, type JoinFn } from './net'
import { deriveClientId } from './profile'
import { authorize, thumbFor, type Command, type ViewState } from './protocol'
import { enqueue, getState, moveInQueue, removeFromQueue, subscribe } from './store'

function currentView(hostId: string): ViewState | null {
  const s = getState()
  if (!s) return null
  return { hostId, roomCode: s.roomCode, queue: s.queue, nowPlaying: s.nowPlaying?.item ?? null }
}

async function apply(cmd: Command) {
  const clientId = await deriveClientId(cmd.secret)
  const s = getState()
  if (!s || !authorize(cmd, s.queue, clientId)) return
  switch (cmd.t) {
    case 'add':
      enqueue({ videoId: cmd.videoId, title: cmd.title, thumb: thumbFor(cmd.videoId), singer: cmd.singer, addedBy: clientId })
      break
    case 'remove':
      removeFromQueue(cmd.id)
      break
    case 'move':
      moveInQueue(cmd.id, cmd.delta)
      break
  }
}

// Commands are applied one at a time, in arrival order, even though hashing is async
let chain: Promise<void> = Promise.resolve()
const applyInOrder = (cmd: Command) => {
  chain = chain.then(() => apply(cmd)).catch(() => {})
}

// Shares the host's session with guests; returns a function that stops sharing
export function startHostLink(roomCode: string, join?: JoinFn) {
  let id = ''
  const link = connectHost(roomCode, { getView: () => currentView(id), onCommand: applyInOrder }, join)
  id = link.selfId

  let last = ''
  const push = () => {
    const v = currentView(id)
    if (!v) return
    // Playback position saves also notify the store, so skip identical views
    const json = JSON.stringify(v)
    if (json === last) return
    last = json
    link.broadcast(v)
  }
  const unsubscribe = subscribe(push)
  push()
  return () => {
    unsubscribe()
    link.close()
  }
}
