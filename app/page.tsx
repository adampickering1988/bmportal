'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push('/candidate')
      } else {
        setError(data.error || 'Invalid access code. Please check and try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex flex-col">
      <div className="h-1 bg-[#C0392B] w-full" />
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="text-xs font-bold tracking-[0.25em] text-[#C0392B] uppercase mb-2">Ideal Direct</div>
            <h1 className="text-4xl font-black text-white tracking-tight">Brand X</h1>
            <p className="text-[#6B7A8D] text-sm mt-2 tracking-wide">Amazon Account Manager Assessment</p>
          </div>
          <div className="bg-[#1A2E45] rounded-xl p-8 border border-[#243E59]">
            <h2 className="text-white font-bold text-lg mb-1">Candidate Login</h2>
            <p className="text-[#6B7A8D] text-sm mb-6">Enter the access code from your invitation email to begin.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-2">Access Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DEMO01"
                  className="w-full bg-[#0D1B2A] border border-[#243E59] rounded-lg px-4 py-3 text-white placeholder-[#3D5269] text-lg font-mono tracking-widest focus:outline-none focus:border-[#C0392B] uppercase"
                  required autoFocus autoComplete="off"
                />
              </div>
              {error && <div className="bg-[#2D1515] border border-[#C0392B] rounded-lg px-4 py-3 text-[#E74C3C] text-sm">{error}</div>}
              <button type="submit" disabled={loading || !code.trim()}
                className="w-full bg-[#C0392B] hover:bg-[#A93226] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors text-base">
                {loading ? 'Verifying…' : 'Begin Assessment →'}
              </button>
            </form>
          </div>
          <div className="text-center mt-8">
            <a href="/recruiter" className="text-xs text-[#3D5269] hover:text-[#6B7A8D] transition-colors">Recruiter portal →</a>
          </div>
        </div>
      </div>
      <div className="h-1 bg-[#C0392B] w-full" />
    </div>
  )
}
