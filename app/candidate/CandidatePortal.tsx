'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { CandidateRecord, Submission } from '@/lib/db'

export default function CandidatePortal({
  candidate,
  submissions,
}: {
  candidate: CandidateRecord
  submissions: Submission[]
}) {
  const [activeTab, setActiveTab] = useState<'instructions' | 'listings' | 'data' | 'submit'>('instructions')
  const router = useRouter()

  const hasAds = submissions.some(s => s.task === 'ads')
  const hasListings = submissions.some(s => s.task === 'listings')

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#EAEDED]">
      {/* Header */}
      <header className="bg-[#0D1B2A] border-b-4 border-[#C0392B]">
        <div className="max-w-7xl mx-auto px-6 py-0">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[10px] font-bold tracking-widest text-[#C0392B] uppercase">Ideal Direct</div>
                <div className="text-white font-black text-lg leading-tight">Brand X Assessment</div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <div className="text-xs text-[#6B7A8D]">Logged in as</div>
                <div className="text-white text-sm font-bold">{candidate.name}</div>
              </div>
              <button onClick={logout} className="text-xs text-[#6B7A8D] hover:text-white border border-[#243E59] hover:border-[#6B7A8D] px-3 py-1.5 rounded transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1">
            {[
              { id: 'instructions', label: '📋 Instructions' },
              { id: 'listings',     label: '🛒 Product Listings' },
              { id: 'data',         label: '📊 Performance Data' },
              { id: 'submit',       label: `✉️ Submit Response${hasAds && hasListings ? ' ✓' : ''}` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-3 text-sm font-bold border-b-3 transition-colors ${
                  activeTab === tab.id
                    ? 'text-white border-b-4 border-[#C0392B]'
                    : 'text-[#6B7A8D] border-b-4 border-transparent hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {activeTab === 'instructions' && <InstructionsTab onNext={() => setActiveTab('listings')} />}
        {activeTab === 'listings'     && <ListingsTab />}
        {activeTab === 'data'         && <DataTab />}
        {activeTab === 'submit'       && (
          <SubmitTab
            hasAds={hasAds}
            hasListings={hasListings}
            submissions={submissions}
            onRefresh={() => router.refresh()}
          />
        )}
      </main>
    </div>
  )
}

// ── Instructions Tab ────────────────────────────────────────────────────────
function InstructionsTab({ onNext }: { onNext: () => void }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-[#0D1B2A] rounded-xl p-8 text-white">
        <div className="text-xs font-bold tracking-widest text-[#C0392B] uppercase mb-3">Amazon Account Manager Assessment</div>
        <h1 className="text-3xl font-black mb-2">Brand X</h1>
        <p className="text-[#9BAAB8] text-base">Health Supplements · Amazon UK · 90 minutes</p>
      </div>

      <Section title="Overview">
        <p className="text-[15px] text-[#2C3E50] leading-relaxed">
          You have been assigned to manage Brand X, a health supplement brand selling on Amazon UK.
          The brand has 6 active SKUs generating approximately £39,000 in revenue over the past 30 days.
        </p>
        <p className="text-[15px] text-[#2C3E50] leading-relaxed mt-3">
          You have 90 minutes to review the data provided, identify performance issues, and produce a written
          analysis with prioritised recommendations. Work methodically through each data source. There are no
          trick questions — trust the numbers.
        </p>
      </Section>

      <Section title="Files Available">
        <div className="space-y-3">
          {[
            { icon:'📊', tab:'Performance Data', label:'BrandX_Performance_Data.xlsx', desc:'30-day ads data across three tabs: Dashboard, Ad Campaign Report, and Search Term Report. Includes organic keyword rank and monthly search volumes.' },
            { icon:'🛒', tab:'Product Listings',  label:'BrandX_Product_Listings.html', desc:'Three mock Amazon product listings. Review each SKU in full — title, bullets, A+ content, images, variations, and backend keyword data.' },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-4 bg-[#F4F6F8] border border-[#E8EBF0] rounded-lg p-4">
              <div className="text-2xl mt-0.5">{f.icon}</div>
              <div>
                <div className="font-bold text-[#0D1B2A] text-sm">{f.label}</div>
                <div className="text-xs text-[#6B7A8D] mt-0.5 mb-1.5">Access via the "{f.tab}" tab above</div>
                <div className="text-[13px] text-[#2C3E50]">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Your Task">
        <div className="space-y-4">
          {[
            { letter:'A', title:'Account Overview', body:'Review the Dashboard and Ad Campaign Report. Summarise overall account health and identify which SKUs and campaign types are performing well or poorly. Support every observation with a specific metric.' },
            { letter:'B', title:'Advertising Analysis', body:'Analyse the Ad Campaign Report and Search Term Report in detail. Identify search terms that should be negated, keyword cannibalisation between campaigns, under-invested opportunities, and campaigns where budget should be reduced or paused. For each issue: state the problem, show the numbers, and give a specific action.' },
            { letter:'C', title:'SKU Deep-Dive: BX-009', body:'BX-009 (Turmeric Curcumin) has 4 active campaigns but is the worst performer in the account. Diagnose the root cause and recommend a specific course of action — which campaigns to continue, pause, or change, and why.' },
            { letter:'D', title:'Listing Quality', body:'Review all three product listings. For each, identify any issues across title, bullet points, A+ content, product description, images, variations, and backend keywords. For each issue: describe the problem, explain why it matters, and recommend a fix.' },
          ].map(t => (
            <div key={t.letter} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[#C0392B] text-white font-black text-sm rounded flex items-center justify-center">{t.letter}</div>
              <div>
                <div className="font-bold text-[#0D1B2A] text-sm mb-1">{t.title}</div>
                <div className="text-[13px] text-[#2C3E50] leading-relaxed">{t.body}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Submission">
        <ul className="space-y-2 text-[14px] text-[#2C3E50]">
          <li className="flex gap-2"><span className="text-[#C0392B] font-bold">·</span> Use the <strong>Submit Response</strong> tab when you are ready. You can submit a written response (typed directly) and/or upload a file for each task.</li>
          <li className="flex gap-2"><span className="text-[#C0392B] font-bold">·</span> You may submit each task separately — partial submissions are saved.</li>
          <li className="flex gap-2"><span className="text-[#C0392B] font-bold">·</span> Cite campaign IDs and specific figures throughout. Vague observations without data carry no weight.</li>
          <li className="flex gap-2"><span className="text-[#C0392B] font-bold">·</span> No prior supplement knowledge is required or expected.</li>
        </ul>
      </Section>

      <div className="flex justify-end">
        <button onClick={onNext} className="bg-[#C0392B] hover:bg-[#A93226] text-white font-bold py-3 px-8 rounded-lg transition-colors">
          View Product Listings →
        </button>
      </div>
    </div>
  )
}

// ── Listings Tab ─────────────────────────────────────────────────────────────
function ListingsTab() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-[#E8EBF0] p-4">
        <h2 className="font-black text-[#0D1B2A] text-lg mb-1">Product Listings</h2>
        <p className="text-[13px] text-[#6B7A8D]">Three mock Amazon UK product listings. Review each in full — use the tabs inside the frame to switch between SKUs.</p>
      </div>
      <div className="bg-white rounded-lg border border-[#E8EBF0] overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}>
        <iframe
          src="/api/files/listings"
          className="w-full h-full border-none"
          title="Brand X Product Listings"
        />
      </div>
    </div>
  )
}

// ── Data Tab ─────────────────────────────────────────────────────────────────
function DataTab() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border border-[#E8EBF0] p-6">
        <h2 className="font-black text-[#0D1B2A] text-lg mb-2">Performance Data</h2>
        <p className="text-[14px] text-[#6B7A8D] mb-6">Download the Excel file and open it in Microsoft Excel or Google Sheets. It contains three tabs of 30-day performance data.</p>

        <a href="/api/files/excel" download="BrandX_Performance_Data.xlsx"
          className="flex items-center gap-4 bg-[#F4F6F8] border-2 border-[#E8EBF0] hover:border-[#0D1B2A] rounded-lg p-5 transition-colors group">
          <div className="text-4xl">📊</div>
          <div className="flex-1">
            <div className="font-bold text-[#0D1B2A] group-hover:text-[#C0392B] transition-colors">BrandX_Performance_Data.xlsx</div>
            <div className="text-xs text-[#6B7A8D] mt-0.5">Excel spreadsheet · Dashboard, Ad Campaign Report, Search Term Report</div>
          </div>
          <div className="text-[#C0392B] font-bold text-sm">↓ Download</div>
        </a>
      </div>

      <div className="bg-[#F4F6F8] border border-[#E8EBF0] rounded-lg p-5 space-y-3">
        <div className="font-bold text-[#0D1B2A] text-sm">What the file contains</div>
        {[
          ['Dashboard','SKU-level 30-day overview: sessions, conversion rate, units, revenue, ad spend, ACoS, TACoS, campaign count.'],
          ['Ad Campaign Report','One row per campaign. Includes: type (SP/SB/SBV/SD), match type, SKU, impressions, clicks, spend, sales, ACoS, CTR, CVR, CPC, ROAS, TOS impression share %, and TOS bid multiplier %.'],
          ['Search Term Report','One row per search term. Includes: campaign, ad type, match type, search term or target, organic rank, monthly search volume, impressions, clicks, spend, sales, ACoS, CVR, and TOS impression share %.'],
        ].map(([tab, desc]) => (
          <div key={tab} className="flex gap-3">
            <span className="text-[#C0392B] font-bold text-xs mt-0.5 flex-shrink-0">›</span>
            <div><span className="font-bold text-[#0D1B2A] text-[13px]">{tab}:</span>{' '}<span className="text-[#2C3E50] text-[13px]">{desc}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Submit Tab ───────────────────────────────────────────────────────────────
function SubmitTab({ hasAds, hasListings, submissions, onRefresh }: {
  hasAds: boolean; hasListings: boolean; submissions: Submission[]; onRefresh: () => void
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border border-[#E8EBF0] p-5">
        <h2 className="font-black text-[#0D1B2A] text-lg mb-1">Submit Your Response</h2>
        <p className="text-[13px] text-[#6B7A8D]">Submit each task separately. You can type your response directly, upload a document, or both. Submissions are saved immediately.</p>
        <div className="flex gap-4 mt-4">
          <StatusPill done={hasAds}      label="Task 1: Advertising Analysis" />
          <StatusPill done={hasListings} label="Task 2: Listing Quality" />
        </div>
      </div>

      <TaskSubmitForm
        task="ads"
        title="Task 1 — Advertising Analysis (Sections A, B & C)"
        description="Your analysis of account performance, advertising issues, and the BX-009 root cause diagnosis."
        submitted={submissions.filter(s => s.task === 'ads')}
        onSubmit={onRefresh}
      />

      <TaskSubmitForm
        task="listings"
        title="Task 2 — Listing Quality Analysis (Section D)"
        description="Your analysis of the three product listings — issues identified and recommendations."
        submitted={submissions.filter(s => s.task === 'listings')}
        onSubmit={onRefresh}
      />
    </div>
  )
}

function StatusPill({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border ${
      done ? 'bg-[#D5F5E3] border-[#27AE60] text-[#1E8449]' : 'bg-[#F4F6F8] border-[#E8EBF0] text-[#6B7A8D]'
    }`}>
      <span>{done ? '✓' : '○'}</span>
      <span>{label}</span>
    </div>
  )
}

function TaskSubmitForm({ task, title, description, submitted, onSubmit }: {
  task: 'ads' | 'listings'; title: string; description: string
  submitted: Submission[]; onSubmit: () => void
}) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const hasSub = submitted.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() && !file) { setError('Please add a written response or upload a file.'); return }
    setError(''); setLoading(true)
    try {
      const fd = new FormData()
      fd.append('task', task)
      if (text.trim()) fd.append('text', text)
      if (file) fd.append('file', file)
      const res = await fetch('/api/submit', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true); setText(''); setFile(null)
        if (fileRef.current) fileRef.current.value = ''
        onSubmit()
      } else {
        setError(data.error || 'Submission failed')
      }
    } catch { setError('Something went wrong. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-white rounded-lg border border-[#E8EBF0] overflow-hidden">
      <div className="bg-[#0D1B2A] px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-sm">{title}</div>
          <div className="text-[#6B7A8D] text-xs mt-0.5">{description}</div>
        </div>
        {hasSub && <div className="text-xs font-bold text-[#27AE60] bg-[#1A2E45] px-3 py-1 rounded-full">✓ Submitted</div>}
      </div>

      {hasSub && (
        <div className="px-6 py-3 bg-[#F4F6F8] border-b border-[#E8EBF0]">
          <div className="text-xs font-bold text-[#6B7A8D] mb-2">Previous submissions:</div>
          {submitted.map(s => (
            <div key={s.id} className="text-xs text-[#2C3E50] flex items-center gap-2">
              <span className="text-[#27AE60]">✓</span>
              {s.type === 'file'
                ? <span>File: <strong>{s.fileName}</strong></span>
                : <span>Written response ({s.content?.length} chars)</span>
              }
              <span className="text-[#6B7A8D]">· {new Date(s.submittedAt).toLocaleString('en-GB')}</span>
            </div>
          ))}
          <div className="text-xs text-[#6B7A8D] mt-2">You may submit an updated response below:</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-2">Written Response</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type your analysis here… Include campaign IDs and specific figures throughout."
            rows={10}
            className="w-full border border-[#D5D9D9] rounded-lg px-4 py-3 text-[14px] text-[#0F1111] placeholder-[#B0B8C4] focus:outline-none focus:border-[#C0392B] focus:ring-1 focus:ring-[#C0392B] resize-y font-mono leading-relaxed"
          />
          <div className="text-xs text-[#6B7A8D] mt-1">{text.length} characters</div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#6B7A8D] uppercase tracking-wider mb-2">Or Upload a Document</label>
          <div className="border-2 border-dashed border-[#E8EBF0] hover:border-[#C0392B] rounded-lg p-5 text-center transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">📄</span>
                <div className="text-left">
                  <div className="font-bold text-[#0D1B2A] text-sm">{file.name}</div>
                  <div className="text-xs text-[#6B7A8D]">{(file.size / 1024).toFixed(0)} KB</div>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); setFile(null); if(fileRef.current) fileRef.current.value='' }}
                  className="ml-4 text-xs text-[#C0392B] hover:underline">Remove</button>
              </div>
            ) : (
              <div>
                <div className="text-3xl mb-2">📎</div>
                <div className="text-sm text-[#6B7A8D]">Click to upload a file</div>
                <div className="text-xs text-[#B0B8C4] mt-1">.docx, .pdf, .xlsx — max 10MB</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".docx,.pdf,.xlsx,.txt,.doc" className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>

        {error && <div className="bg-[#FDF2F2] border border-[#E74C3C] rounded-lg px-4 py-3 text-[#C0392B] text-sm">{error}</div>}
        {success && <div className="bg-[#D5F5E3] border border-[#27AE60] rounded-lg px-4 py-3 text-[#1E8449] text-sm font-bold">✓ Response submitted successfully.</div>}

        <div className="flex justify-end">
          <button type="submit" disabled={loading}
            className="bg-[#C0392B] hover:bg-[#A93226] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-colors">
            {loading ? 'Submitting…' : hasSub ? 'Update Submission' : 'Submit Response'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Generic section wrapper ───────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-[#E8EBF0] overflow-hidden">
      <div className="px-6 py-3 bg-[#F4F6F8] border-b border-[#E8EBF0]">
        <h3 className="font-bold text-[#0D1B2A] text-sm">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}
