# 🎤 UKaraoke

Client-only karaoke. Host a session, search YouTube for karaoke videos, build a shared queue and invite friends to add songs from their own devices. Everything runs in the browser, with peer-to-peer sync and no backend.

**Try it:** https://mattvane.github.io/ukaraoke/

## Features

- **Host a session** – the host's screen plays each queued video in turn.
- **Search** – finds karaoke videos via a [Piped](https://github.com/TeamPiped/Piped) API instance. Videos that can't be embedded are checked before adding and shown as unavailable.
- **Shared queue** – add, remove and reorder songs. Guests can only remove or move their own songs.
- **Join from other devices** – share a 6-character room code, link or QR code.
- **Survives refreshes** – the queue and session are saved in `localStorage`.
- **One host per browser** – a second tab can't take over a session that is already hosted.

## How to use

1. Open the app and enter a name.
2. **Start new session** on the screen that will play the videos (e.g. a laptop connected to a TV).
3. Use the invite button (room code in the header) to show the QR code or copy the join link.
4. Guests scan the code or paste it into **Join**, then search and add songs.
5. The host can skip songs, reorder the queue and end the session.

## How it works

- **Peer-to-peer:** [Trystero](https://github.com/dmotz/trystero) uses public Nostr relays for signalling and then WebRTC data channels for traffic.
- **Host is the authority:** the host holds the queue and broadcasts its view. Guests send commands (`add`, `remove`, `move`) and the host validates them.
- **Identity:** each browser keeps a private random secret. The host derives a client ID from it (SHA-256) and uses it for per-song ownership. The secret is never shared with other guests.
- **Playback:** the YouTube IFrame Player API.
- **Persistence:** `localStorage`, with keys prefixed `ukaraoke.`.

## Limitations

- **No TURN server.** Guests behind strict NATs or some corporate networks may not connect.
- **The room code is the only access control.** Anyone with the code can join.
- **Search depends on public Piped instances,** which are often unreliable. If search fails, try again later.
- **Some videos can't be embedded.** They are skipped with a notice and remembered on that device.
- **HTTPS is required** (Web Crypto, Web Locks and WebRTC). GitHub Pages and `localhost` both work.
- If the host closes their tab, guests reconnect once the host returns, which can take 15–20 seconds.

## Development

Requires Node 22+.

```sh
npm install
npm run dev      # Vite dev server over HTTPS (self-signed cert)
npm test         # vitest unit and integration tests
npm run lint     # oxlint
npm run build    # typecheck and production build into dist/
```

The dev server uses a self-signed certificate. To test with a phone on your network, open `https://<your-lan-ip>:5173/ukaraoke/` and accept the browser warning.

### Project layout

| File | Purpose |
|------|---------|
| `src/App.tsx` | Top-level UI, tabs and session wiring |
| `src/Home.tsx`, `Share.tsx`, `NamePrompt.tsx`, `QueueRow.tsx`, `SearchPanel.tsx` | UI components |
| `src/store.ts` | Session and queue state, persisted to `localStorage` |
| `src/protocol.ts` | Message types, validation and authorization |
| `src/host.ts`, `guest.ts`, `net.ts` | Host and guest P2P links |
| `src/profile.ts` | Name, secret and derived client ID |
| `src/lock.ts` | Single-host lock across tabs |
| `src/search.ts` | Piped search with instance fallback |
| `src/probe.ts`, `yt.ts`, `unplayable.ts`, `Player.tsx` | Embeddability checks, YouTube loader, blocklist and player |

### Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and deploys to GitHub Pages. The Vite `base` is `/ukaraoke/`, so change it in `vite.config.ts` if you fork under another repository name.
