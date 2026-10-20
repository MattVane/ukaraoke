import { joinRoom, selfId } from 'trystero'
import { parseCommand, parseView, type Command, type ViewState } from './protocol'

// Namespaces our rooms away from other Trystero apps on the same relays
const APP_ID = 'karaoke-web-4f7c1e'

interface ActionLike {
  send(data: unknown, opts?: { target?: string }): unknown
  onMessage: ((data: unknown, ctx: { peerId: string }) => void) | null | undefined
}

export interface RoomLike {
  makeAction(id: string): ActionLike
  onPeerJoin: ((peerId: string) => void) | null | undefined
  onPeerLeave: ((peerId: string) => void) | null | undefined
  leave(): unknown
}

export interface Joined {
  room: RoomLike
  selfId: string
}

export type JoinFn = (roomCode: string) => Joined

export const defaultJoin: JoinFn = (roomCode) => ({
  room: joinRoom({ appId: APP_ID }, roomCode) as unknown as RoomLike,
  selfId,
})

export interface HostLink {
  selfId: string
  broadcast(view: ViewState): void
  close(): void
}

export function connectHost(
  roomCode: string,
  deps: { getView(): ViewState | null; onCommand(cmd: Command): void },
  join: JoinFn = defaultJoin,
): HostLink {
  const { room, selfId: id } = join(roomCode)
  const view = room.makeAction('view')
  const cmd = room.makeAction('cmd')

  room.onPeerJoin = (peerId) => {
    const v = deps.getView()
    if (v) view.send(v, { target: peerId })
  }
  cmd.onMessage = (raw) => {
    const parsed = parseCommand(raw)
    if (parsed) deps.onCommand(parsed)
  }

  return { selfId: id, broadcast: (v) => view.send(v), close: () => room.leave() }
}

export interface GuestLink {
  send(cmd: Command): boolean
  close(): void
}

export function connectGuest(
  roomCode: string,
  handlers: { onView(view: ViewState): void; onHostLeft(): void },
  join: JoinFn = defaultJoin,
): GuestLink {
  const { room } = join(roomCode)
  const view = room.makeAction('view')
  const cmd = room.makeAction('cmd')
  let hostPeer: string | null = null

  view.onMessage = (raw, { peerId }) => {
    const v = parseView(raw)
    // Only accept views a peer sends about itself as host, for the room we joined
    if (!v || v.hostId !== peerId || v.roomCode !== roomCode) return
    hostPeer = peerId
    handlers.onView(v)
  }
  room.onPeerLeave = (peerId) => {
    if (peerId !== hostPeer) return
    hostPeer = null
    handlers.onHostLeft()
  }

  return {
    send(c) {
      if (!hostPeer) return false
      cmd.send(c, { target: hostPeer })
      return true
    },
    close: () => room.leave(),
  }
}
