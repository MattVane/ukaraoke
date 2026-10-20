import { useEffect, useRef } from 'react'
import { playNext, savePosition, type QueueItem } from './store'
import { reportUnplayable } from './unplayable'

import { loadYT } from './yt'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  item: QueueItem
  startSeconds: number
}

export function Player({ item, startSeconds }: Props) {
  const { id, videoId, title } = item
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<any>(null)
  const startRef = useRef(startSeconds)

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    loadYT().then((YT) => {
      if (cancelled || !host.current) return
      const el = document.createElement('div')
      host.current.replaceChildren(el)
      player.current = new YT.Player(el, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: { autoplay: 1, start: Math.floor(startRef.current), rel: 0 },
        events: {
          onReady: (e: any) => e.target.playVideo(),
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.ENDED) playNext()
          },
          // Embedding disabled or video unavailable: tell the host, then skip it
          onError: (e: any) => {
            reportUnplayable({ videoId, title }, e.data)
            playNext()
          },
        },
      })
      timer = window.setInterval(() => {
        const t = player.current?.getCurrentTime?.()
        if (typeof t === 'number') savePosition(Math.floor(t))
      }, 5000)
    })
    return () => {
      cancelled = true
      window.clearInterval(timer)
      player.current?.destroy?.()
      player.current = null
    }
  }, [id, videoId, title])

  return <div ref={host} className="player" />
}
