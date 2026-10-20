import { useEffect, useRef } from 'react'
import { playNext, savePosition, type QueueItem } from './store'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<any> | null = null
function loadYT(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  })
  return apiPromise
}

interface Props {
  item: QueueItem
  startSeconds: number
}

export function Player({ item, startSeconds }: Props) {
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
        videoId: item.videoId,
        playerVars: { autoplay: 1, start: Math.floor(startRef.current), rel: 0 },
        events: {
          onReady: (e: any) => e.target.playVideo(),
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.ENDED) playNext()
          },
          // Embedding disabled or video unavailable: skip it
          onError: () => playNext(),
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
  }, [item.id, item.videoId])

  return <div ref={host} className="player" />
}
