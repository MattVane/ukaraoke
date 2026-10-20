import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

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
export function JoinCard({ roomCode }: { roomCode: string }) {
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

export function ShareDialog({ roomCode, onClose }: { roomCode: string; onClose: () => void }) {
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

