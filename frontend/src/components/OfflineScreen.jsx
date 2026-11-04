import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

// Blocks the whole app while the device is offline: nothing is cached or queued,
// everything needs the internet.
export default function OfflineScreen() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="alert"
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-red-600 p-6 text-center text-white"
    >
      <WifiOff size={64} />
      <h1 className="text-2xl font-bold">You are offline</h1>
      <p className="max-w-xs text-lg">Connect to the internet to use SwimAcademy.</p>
    </div>
  )
}
