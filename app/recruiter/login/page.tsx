'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RecruiterLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/recruiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (res.ok) router.push('/recruiter')
      else setError(data.error || 'Incorrect password')
    } catch { setError('Something went wrong.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col">
      <div className="h-1 bg-[#C0392B] w-full" />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="text-xs font-bold tracking-[0.25em] text-[#C0392B] uppercase mb-2">Ideal Direct</div>
            <h1 className="text-3xl font-black text-white">Recruiter Portal</h1>
            <p className="text-[#6B7A8D] text-sm mt-2">Brand Manager Recruitment · Internal access only</p>
          </div>
          <div className="bg-[#1A2E45] rounded-xl p-8 border border-[#243E59]">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-2">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#0D1B2A] border border-[#243E59] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#C0392B]"
                  required autoFocus />
              </div>
              {error && <div className="bg-[#2D1515] border border-[#C0392B] rounded-lg px-4 py-3 text-[#E74C3C] text-sm">{error}</div>}
              <button type="submit" disabled={loading || !password}
                className="w-full bg-[#C0392B] hover:bg-[#A93226] disabled:opacity-40 text-white font-bold py-3 rounded-lg transition-colors">
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>
            </form>
          </div>
          <div className="text-center mt-6">
            <a href="/" className="text-xs text-[#3D5269] hover:text-[#6B7A8D]">← Candidate portal</a>
          </div>
        </div>
      </div>
      <div className="h-1 bg-[#C0392B] w-full" />
    </div>
  )
}
