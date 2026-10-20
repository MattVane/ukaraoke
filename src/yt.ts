/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<any> | null = null
export function loadYT(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  })
  return apiPromise
}
