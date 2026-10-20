import { connectHost, type JoinFn } from './net'
import { authorize, thumbFor, type Command, type ViewState } from './protocol'
import { enqueue, getState, moveInQueue, removeFromQueue, subscribe } from './store'

function currentView(hostId: string): ViewState | null {
  const s = getState()
  if (!s) return null
  return { hostId, roomCode: s.roomCode, queue: s.queue, nowPlaying: s.nowPlaying?.item ?? null }
}

function apply(cmd: Command) {
  const s = getState()
  if (!s || !authorize(cmd, s.queue)) return
  switch (cmd.t) {
    case 'add':
      enqueue({ videoId: cmd.videoId, title: cmd.title, thumb: thumbFor(cmd.videoId), singer: cmd.singer, addedBy: cmd.clientId })
      break
    case 'remove':
      removeFromQueue(cmd.id)
      break
    case 'move':
      moveInQueue(cmd.id, cmd.delta)
      break
  }
}

// Shares the host's session with guests; returns a function that stops sharing
export function startHostLink(roomCode: string, join?: JoinFn) {
  let id = ''
  const link = connectHost(roomCode, { getView: () => currentView(id), onCommand: apply }, join)
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
