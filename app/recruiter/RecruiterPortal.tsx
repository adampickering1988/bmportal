'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CandidateRecord, Submission } from '@/lib/db'

export default function RecruiterPortal({
  candidates,
  submissions,
}: {
  candidates: CandidateRecord[]
  submissions: Submission[]
}) {
  const [activeTab, setActiveTab] = useState<'candidates' | 'submissions' | 'resources' | 'add'>('candidates')
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/recruiter/login')
  }

  const submittedCount = candidates.filter(c => c.submittedAt).length
  const startedCount   = candidates.filter(c => c.startedAt && !c.submittedAt).length

  return (
    <div className="min-h-screen flex flex-col bg-[#EAEDED]">
      <header className="bg-[#0D1B2A] border-b-4 border-[#C0392B]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div>
              <div className="text-[10px] font-bold tracking-widest text-[#C0392B] uppercase">Ideal Direct · Internal</div>
              <div className="text-white font-black text-lg">Brand X — Recruiter Portal</div>
            </div>
            <button onClick={logout} className="text-xs text-[#6B7A8D] hover:text-white border border-[#243E59] hover:border-[#6B7A8D] px-3 py-1.5 rounded transition-colors">
              Log out
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1">
            {[
              { id:'candidates',  label:'👥 Candidates' },
              { id:'submissions', label:'📬 Submissions' },
              { id:'resources',   label:'📁 Resources' },
              { id:'add',         label:'+ Add Candidate' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-3 text-sm font-bold border-b-4 transition-colors ${activeTab === tab.id ? 'text-white border-[#C0392B]' : 'text-[#6B7A8D] border-transparent hover:text-white'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Stats bar */}
      <div className="bg-[#1A2E45] border-b border-[#243E59]">
        <div className="max-w-7xl mx-auto px-6 py-3 flex gap-8">
          {[
            { label:'Total Candidates', value:candidates.length },
            { label:'Not Started',      value:candidates.filter(c=>!c.startedAt).length },
            { label:'In Progress',      value:startedCount },
            { label:'Submitted',        value:submittedCount },
            { label:'Total Submissions',value:submissions.length },
          ].map(s => (
            <div key={s.label}>
              <div className="text-[#6B7A8D] text-xs">{s.label}</div>
              <div className="text-white font-black text-xl">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {activeTab === 'candidates'  && <CandidatesTab candidates={candidates} submissions={submissions} />}
        {activeTab === 'submissions' && <SubmissionsTab submissions={submissions} />}
        {activeTab === 'resources'   && <ResourcesTab />}
        {activeTab === 'add'         && <AddCandidateTab onAdded={() => { router.refresh(); setActiveTab('candidates') }} />}
      </main>
    </div>
  )
}

// ── Candidates Tab ────────────────────────────────────────────────────────────
function CandidatesTab({ candidates, submissions }: { candidates: CandidateRecord[]; submissions: Submission[] }) {
  const getStatus = (c: CandidateRecord) => {
    if (c.submittedAt) return { label:'Submitted', cls:'bg-[#D5F5E3] text-[#1E8449] border-[#27AE60]' }
    if (c.startedAt)   return { label:'In Progress', cls:'bg-[#FEF9E7] text-[#D4A017] border-[#F39C12]' }
    return { label:'Not Started', cls:'bg-[#F4F6F8] text-[#6B7A8D] border-[#E8EBF0]' }
  }

  return (
    <div className="bg-white rounded-lg border border-[#E8EBF0] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E8EBF0] bg-[#F4F6F8]">
        <h2 className="font-bold text-[#0D1B2A]">All Candidates ({candidates.length})</h2>
      </div>
      {candidates.length === 0 ? (
        <div className="px-6 py-12 text-center text-[#6B7A8D]">No candidates yet. Use "Add Candidate" to create access codes.</div>
      ) : (
        <div className="divide-y divide-[#E8EBF0]">
          {candidates.map(c => {
            const st = getStatus(c)
            const subCount = submissions.filter(s => s.candidateCode === c.code).length
            return (
              <div key={c.code} className="px-6 py-4 flex items-center justify-between hover:bg-[#FAFBFC]">
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 bg-[#0D1B2A] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {c.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <div className="font-bold text-[#0D1B2A] text-sm">{c.name}</div>
                    <div className="text-xs text-[#6B7A8D]">{c.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-xs text-[#6B7A8D]">Code</div>
                    <div className="font-mono font-bold text-[#0D1B2A] text-sm tracking-widest">{c.code}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-[#6B7A8D]">Submissions</div>
                    <div className="font-bold text-[#0D1B2A] text-sm">{subCount}</div>
                  </div>
                  {c.startedAt && (
                    <div className="text-center hidden md:block">
                      <div className="text-xs text-[#6B7A8D]">Started</div>
                      <div className="text-xs text-[#0D1B2A]">{new Date(c.startedAt).toLocaleDateString('en-GB')}</div>
                    </div>
                  )}
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Submissions Tab ───────────────────────────────────────────────────────────
function SubmissionsTab({ submissions }: { submissions: Submission[] }) {
  const [selected, setSelected] = useState<Submission | null>(null)

  if (selected) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button onClick={() => setSelected(null)} className="text-sm text-[#C0392B] hover:underline font-bold">← Back to all submissions</button>
        <div className="bg-white rounded-lg border border-[#E8EBF0] overflow-hidden">
          <div className="bg-[#0D1B2A] px-6 py-4">
            <div className="text-white font-bold">{selected.candidateName}</div>
            <div className="text-[#6B7A8D] text-xs mt-0.5">{selected.candidateEmail} · {selected.task === 'ads' ? 'Task 1: Advertising Analysis' : 'Task 2: Listing Quality'}</div>
          </div>
          <div className="px-6 py-5">
            <div className="text-xs text-[#6B7A8D] mb-3">Submitted: {new Date(selected.submittedAt).toLocaleString('en-GB')}</div>
            {selected.type === 'file' ? (
              <div className="bg-[#F4F6F8] border border-[#E8EBF0] rounded-lg p-5 flex items-center gap-4">
                <span className="text-3xl">📄</span>
                <div>
                  <div className="font-bold text-[#0D1B2A]">{selected.fileName}</div>
                  {selected.fileUrl
                    ? <a href={selected.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-[#C0392B] hover:underline font-bold">↓ Download file</a>
                    : <div className="text-sm text-[#6B7A8D]">File stored on server</div>
                  }
                </div>
              </div>
            ) : (
              <div className="bg-[#F4F6F8] border border-[#E8EBF0] rounded-lg p-5">
                <pre className="text-sm text-[#2C3E50] whitespace-pre-wrap font-mono leading-relaxed">{selected.content}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-[#E8EBF0] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E8EBF0] bg-[#F4F6F8]">
        <h2 className="font-bold text-[#0D1B2A]">All Submissions ({submissions.length})</h2>
      </div>
      {submissions.length === 0 ? (
        <div className="px-6 py-12 text-center text-[#6B7A8D]">No submissions yet.</div>
      ) : (
        <div className="divide-y divide-[#E8EBF0]">
          {submissions.map(s => (
            <div key={s.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#FAFBFC] cursor-pointer" onClick={() => setSelected(s)}>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-[#0D1B2A] rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {s.candidateName.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                </div>
                <div>
                  <div className="font-bold text-[#0D1B2A] text-sm">{s.candidateName}</div>
                  <div className="text-xs text-[#6B7A8D]">{s.task === 'ads' ? 'Task 1: Advertising Analysis' : 'Task 2: Listing Quality'} · {s.type === 'file' ? `File: ${s.fileName}` : `Text (${s.content?.length || 0} chars)`}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-xs text-[#6B7A8D] hidden md:block">{new Date(s.submittedAt).toLocaleString('en-GB')}</div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${s.task === 'ads' ? 'bg-[#EAF2FB] text-[#1A5276] border-[#2471A3]' : 'bg-[#FDF2F8] text-[#7D3C98] border-[#9B59B6]'}`}>
                  {s.task === 'ads' ? 'Task 1' : 'Task 2'}
                </span>
                <span className="text-xs text-[#C0392B] font-bold">View →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Resources Tab ─────────────────────────────────────────────────────────────
function ResourcesTab() {
  const files = [
    { label:'Answer Key', sub:'BrandX_Answer_Key_CONFIDENTIAL.docx', icon:'🔑', href:'/api/files/answer-key', note:'Marking guide · 100 marks · 9 sections' },
    { label:'Listing Issues Reference', sub:'BrandX_Listing_Issues_Reference.docx', icon:'📋', href:'/api/files/listing-issues', note:'Per-SKU issue log · BX-009 · BX-011 · BX-012' },
  ]
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-lg border border-[#E8EBF0] p-5">
        <h2 className="font-bold text-[#0D1B2A] mb-1">Assessor Resources</h2>
        <p className="text-[13px] text-[#6B7A8D]">Internal documents for marking and reference. Not visible to candidates.</p>
      </div>
      {files.map(f => (
        <a key={f.label} href={f.href} download
          className="flex items-center gap-5 bg-white border-2 border-[#E8EBF0] hover:border-[#0D1B2A] rounded-lg p-5 transition-colors group block">
          <div className="text-4xl">{f.icon}</div>
          <div className="flex-1">
            <div className="font-bold text-[#0D1B2A] text-sm group-hover:text-[#C0392B] transition-colors">{f.label}</div>
            <div className="text-xs text-[#6B7A8D] mt-0.5">{f.sub}</div>
            <div className="text-xs text-[#9BAAB8] mt-1">{f.note}</div>
          </div>
          <div className="text-[#C0392B] font-bold text-sm">↓ Download</div>
        </a>
      ))}
    </div>
  )
}

// ── Add Candidate Tab ─────────────────────────────────────────────────────────
function AddCandidateTab({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ code: string; name: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/recruiter/create-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, customCode: customCode || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ code: data.code, name })
        setName(''); setEmail(''); setCustomCode('')
        onAdded()
      } else {
        setError(data.error || 'Failed to create candidate')
      }
    } catch { setError('Something went wrong.') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {result && (
        <div className="bg-[#D5F5E3] border border-[#27AE60] rounded-lg p-5">
          <div className="font-bold text-[#1E8449] mb-2">✓ Candidate created</div>
          <div className="text-sm text-[#1E8449]"><strong>{result.name}</strong> can log in with code:</div>
          <div className="font-mono font-black text-2xl text-[#0D1B2A] mt-2 tracking-widest">{result.code}</div>
          <button onClick={() => setResult(null)} className="mt-3 text-xs text-[#6B7A8D] hover:underline">Add another →</button>
        </div>
      )}
      <div className="bg-white rounded-lg border border-[#E8EBF0] overflow-hidden">
        <div className="px-6 py-4 bg-[#F4F6F8] border-b border-[#E8EBF0]">
          <h2 className="font-bold text-[#0D1B2A]">Add New Candidate</h2>
          <p className="text-xs text-[#6B7A8D] mt-0.5">A unique access code will be generated and sent to the candidate.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-2">Full Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full border border-[#D5D9D9] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#C0392B]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-2">Email Address *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border border-[#D5D9D9] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#C0392B]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-2">Custom Code (optional)</label>
            <input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())}
              placeholder="Auto-generated if blank" maxLength={10}
              className="w-full border border-[#D5D9D9] rounded-lg px-4 py-3 text-sm font-mono tracking-widest uppercase focus:outline-none focus:border-[#C0392B]" />
            <div className="text-xs text-[#6B7A8D] mt-1">Leave blank to auto-generate a 6-character code</div>
          </div>
          {error && <div className="bg-[#FDF2F2] border border-[#E74C3C] rounded-lg px-4 py-3 text-[#C0392B] text-sm">{error}</div>}
          <button type="submit" disabled={loading || !name || !email}
            className="w-full bg-[#C0392B] hover:bg-[#A93226] disabled:opacity-40 text-white font-bold py-3 rounded-lg transition-colors">
            {loading ? 'Creating…' : 'Create Candidate'}
          </button>
        </form>
      </div>
    </div>
  )
}
