import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export const NOTICE_MS = 10000
// Set before a full page reload (see api/client.js) so the next page can still show the message.
export const FLASH_KEY = 'flash_notice'

const NoticeContext = createContext({ notify: () => {} })

const tone = {
  info: 'bg-slate-800 text-white',
  warn: 'bg-amber-500 text-slate-900',
  error: 'bg-red-600 text-white',
}

/** One status bar for the whole app: notify('text') shows it at the bottom for 10 seconds. */
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

  return (
    <NoticeContext.Provider value={{ notify }}>
      {children}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`no-print fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 text-sm shadow-[0_-2px_8px_rgba(0,0,0,0.15)] ${tone[notice.kind] || tone.info}`}
        >
          <span>{notice.message}</span>
          <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 opacity-80 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </NoticeContext.Provider>
  )
}

export const useNotice = () => useContext(NoticeContext)
