import { thumbFor } from './protocol'
import type { QueueItem } from './store'

export function QueueRow({ item, first, last, manage, onMove, onRemove }: {
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

