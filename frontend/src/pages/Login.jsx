import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Waves } from 'lucide-react'
import api from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useNotice } from '../context/NoticeContext.jsx'

export default function Login() {
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [otpHint, setOtpHint] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { notify } = useNotice()
  const navigate = useNavigate()

  const requestOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/request-otp', { phone })
      setOtpHint(res.data.otp)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/verify-otp', { phone, code })
      login(res.data.access_token, res.data.user)
      if (res.data.other_sessions_ended) notify('Signed in. Your other signed-in device has been signed out.')
      navigate(res.data.user.role === 'super_admin' ? '/admin' : '/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
        <div className="mb-6 flex items-center justify-center gap-2 text-sky-600">
          <Waves className="h-7 w-7" />
          <span className="text-xl font-bold">SwimAcademy</span>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {otpHint && step === 2 && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            MVP mode — your OTP is <span className="font-mono font-bold">{otpHint}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit phone"
                required
                pattern="[0-9]{10}"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <button
              disabled={loading}
              className="w-full rounded-lg bg-sky-600 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Enter OTP</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                required
                maxLength={6}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-sky-500 focus:outline-none"
              />
            </div>
            <button
              disabled={loading}
              className="w-full rounded-lg bg-sky-600 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify & Login'}
            </button>
            <button
              type="button"
              onClick={() => { setStep(1); setCode(''); setOtpHint(''); setError('') }}
              className="w-full text-sm text-slate-500 hover:text-slate-700"
            >
              ← Change phone number
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-slate-500">
          Signing in ends your session on any other device.
        </p>

        <p className="mt-4 text-center text-sm text-slate-500">
          New academy? <Link to="/register" className="text-sky-600 hover:underline">Register your club</Link>
        </p>
      </div>
    </div>
  )
}
