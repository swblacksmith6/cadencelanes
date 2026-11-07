import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

export const NOTICE_MS = 10000
// Set before a full page reload (see api/client.js) so the next page can still show the message.
export const FLASH_KEY = 'flash_notice'

const NoticeContext = createContext({ notify: () => {}, notice: null, dismiss: () => {} })

// info = blue, success = green, error = red, warn = amber.
const tone = {
  info: { box: 'border-blue-200 bg-blue-50 text-blue-900', Icon: Info },
  success: { box: 'border-green-200 bg-green-100 text-green-800', Icon: CheckCircle2 },
  error: { box: 'border-red-200 bg-red-50 text-red-800', Icon: AlertCircle },
  warn: { box: 'border-amber-100 bg-amber-50 text-amber-800', Icon: TriangleAlert },
}

/** Holds the one current message. Show it with <NoticeBar />; send one with notify('text', kind). */
export function NoticeProvider({ children }) {
  const [notice, setNotice] = useState(null)
  const timer = useRef(null)

  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setNotice(null)
  }, [])

  const notify = useCallback((message, kind = 'info') => {
    clearTimeout(timer.current)
    setNotice({ message, kind })
    timer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLASH_KEY)
      if (raw) {
        sessionStorage.removeItem(FLASH_KEY)
        const { message, kind } = JSON.parse(raw)
        notify(message, kind)
      }
    } catch {
      // storage unavailable: nothing to show
    }
    return () => clearTimeout(timer.current)
  }, [notify])

  return <NoticeContext.Provider value={{ notify, notice, dismiss }}>{children}</NoticeContext.Provider>
}

/**
 * The single place every message appears: the strip just under the top bar.
 * It takes no space until a message comes, then slides over the top of the page just under the bar and
 * goes away after 10 seconds, so nothing on the page moves. The layout positions it under its top bar;
 * on pages without the layout (login, admin) use `floating`.
 */
export function NoticeBar({ floating = false }) {
  const { notice, dismiss } = useNotice()
  const t = notice ? tone[notice.kind] || tone.info : null

  const bar = notice && (
    <div
      role="status"
      aria-live="polite"
      className={`flex h-full items-center gap-3 rounded-xl border px-3 text-[13px] font-medium leading-tight shadow-sm ${t.box}`}
    >
      <t.Icon className="h-5 w-5 shrink-0" />
      <span className="line-clamp-2 min-w-0 flex-1">{notice.message}</span>
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 p-1 opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  )

  if (floating) {
    return notice ? <div className="no-print px-safe pt-safe fixed inset-x-0 top-0 z-50 h-16 pt-3">{bar}</div> : null
  }
  return notice ? <div className="no-print h-12">{bar}</div> : null
}

/** Send a form or request error to the bar whenever it changes to a non-empty message. */
export function useErrorNotice(error) {
  const { notify } = useNotice()
  useEffect(() => {
    if (error) notify(error, 'error')
  }, [error, notify])
}

export const useNotice = () => useContext(NoticeContext)
