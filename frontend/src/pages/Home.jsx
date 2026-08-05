import { Link, Navigate } from 'react-router-dom'
import { Waves } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Home() {
  const { user } = useAuth()
  if (user) return <Navigate to={user.role === 'super_admin' ? '/admin' : '/dashboard'} replace />

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-600 to-sky-800 px-4 text-white">
      <Waves className="mb-4 h-16 w-16 text-sky-200" />
      <h1 className="text-4xl font-bold">SwimAcademy</h1>
      <p className="mt-2 text-sky-100">Track every lap. Grow every swimmer.</p>
      <div className="mt-10 flex gap-4">
        <Link
          to="/login"
          className="rounded-lg bg-white px-8 py-3 font-semibold text-sky-700 shadow hover:bg-sky-50"
        >
          Login
        </Link>
        <Link
          to="/register"
          className="rounded-lg border-2 border-white px-8 py-3 font-semibold text-white hover:bg-white/10"
        >
          Register Club
        </Link>
      </div>
    </div>
  )
}
