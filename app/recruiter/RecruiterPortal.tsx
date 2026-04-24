'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { CandidateRecord, Submission } from '@/lib/db'

async function downloadAnalysisPdf(candidateName: string, candidateEmail: string, analysisMarkdown: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pw = doc.internal.pageSize.getWidth()   // 210
  const ph = doc.internal.pageSize.getHeight()  // 297
  const mx = 18                                  // horizontal margin
  const footerH = 14                             // reserved for footer
  const usable = pw - mx * 2                     // text width
  const lineH = 4.2                              // line height for 9pt body
  let y = mx

  // ── helpers ────────────────────────────────────────────────────────────────
  function newPageIfNeeded(need: number) {
    if (y + need > ph - footerH) { doc.addPage(); y = mx }
  }

  function drawWrapped(text: string, x: number, maxW: number, fontSize: number, style: 'normal' | 'bold', color: [number, number, number]): number {
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', style)
    doc.setTextColor(...color)
    const lines: string[] = doc.splitTextToSize(text, maxW)
    const lh = fontSize * 0.42          // approximate mm per line
    newPageIfNeeded(lines.length * lh + 2)
    doc.text(lines, x, y)
    return lines.length * lh
  }

  // ── header (dark bar) ──────────────────────────────────────────────────────
  doc.setFillColor(13, 27, 42)
  doc.rect(0, 0, pw, 34, 'F')
  doc.setFillColor(192, 57, 43)
  doc.rect(0, 34, pw, 1.2, 'F')        // red accent line
  doc.setTextColor(192, 57, 43)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('IDEAL DIRECT  —  CONFIDENTIAL', mx, 10)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(17)
  doc.text('AI Assessment Analysis', mx, 20)
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(155, 170, 184)
  doc.text(`${candidateName}  ·  ${candidateEmail}`, mx, 27)
  doc.setFontSize(8)
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, mx, 31.5)

  // Score badge in header (right-aligned)
  const { score, pass } = extractScore(analysisMarkdown)
  if (score !== null) {
    const scoreText = `${score} / 100`
    const resultText = pass ? 'PASS' : 'FAIL'
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(scoreText, pw - mx, 19, { align: 'right' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(pass ? 39 : 231, pass ? 174 : 76, pass ? 96 : 60) // green or red
    doc.text(resultText, pw - mx, 27, { align: 'right' })
  }
  y = 42

  // ── parse markdown ─────────────────────────────────────────────────────────
  const raw = analysisMarkdown.split('\n')

  // Pre-parse: collect table blocks so we can draw them as proper grids
  type Block =
    | { type: 'heading'; text: string }
    | { type: 'bullet'; text: string }
    | { type: 'text'; text: string; bold: boolean }
    | { type: 'table'; rows: string[][] }
    | { type: 'gap' }

  const blocks: Block[] = []
  let tableAcc: string[][] | null = null

  for (const line of raw) {
    const t = line.trim()

    // Table row
    if (t.startsWith('|') && t.endsWith('|')) {
      const cells = t.split('|').slice(1, -1).map(c => c.trim())
      if (cells.every(c => /^[\s:-]+$/.test(c))) continue // separator
      if (!tableAcc) tableAcc = []
      tableAcc.push(cells.map(c => c.replace(/\*\*/g, '')))
      continue
    }

    // Flush any accumulated table
    if (tableAcc) { blocks.push({ type: 'table', rows: tableAcc }); tableAcc = null }

    if (!t) { blocks.push({ type: 'gap' }); continue }
    if (t.startsWith('## '))  { blocks.push({ type: 'heading', text: t.replace(/^##\s+/, '') }); continue }
    if (t.startsWith('### ')) { blocks.push({ type: 'heading', text: t.replace(/^###\s+/, '') }); continue }
    if (t.startsWith('- '))   { blocks.push({ type: 'bullet', text: t.replace(/^-\s+/, '').replace(/\*\*/g, '') }); continue }

    const isBold = t.startsWith('**') && t.endsWith('**')
    blocks.push({ type: 'text', text: t.replace(/\*\*/g, ''), bold: isBold })
  }
  if (tableAcc) blocks.push({ type: 'table', rows: tableAcc })

  // ── render blocks ──────────────────────────────────────────────────────────
  for (const block of blocks) {
    switch (block.type) {
      case 'gap':
        y += 2.5
        break

      case 'heading':
        newPageIfNeeded(14)
        y += 5
        doc.setDrawColor(220, 223, 228)
        doc.line(mx, y, pw - mx, y)
        y += 5.5
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(13, 27, 42)
        doc.text(block.text, mx, y)
        y += 6
        break

      case 'bullet': {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        const lines: string[] = doc.splitTextToSize(block.text, usable - 8)
        newPageIfNeeded(lines.length * lineH + 1)
        doc.setTextColor(192, 57, 43)
        doc.text('•', mx + 1, y)
        doc.setTextColor(44, 62, 80)
        doc.text(lines, mx + 6, y)
        y += lines.length * lineH + 1.5
        break
      }

      case 'text': {
        doc.setFontSize(9)
        doc.setFont('helvetica', block.bold ? 'bold' : 'normal')
        doc.setTextColor(block.bold ? 13 : 44, block.bold ? 27 : 62, block.bold ? 42 : 80)
        const lines: string[] = doc.splitTextToSize(block.text, usable)
        newPageIfNeeded(lines.length * lineH + 1)
        doc.text(lines, mx, y)
        y += lines.length * lineH + 1.5
        break
      }

      case 'table': {
        const { rows } = block
        if (rows.length === 0) break
        const numCols = rows[0].length
        const cellPad = 2.5
        const fontSize = 8
        doc.setFontSize(fontSize)
        const cellLH = 3.6

        // Calculate column widths proportionally
        // Give "Notes" (last col) more space if it exists, and thin cols for numbers
        let colWidths: number[]
        if (numCols === 4) {
          // Section | Max | Awarded | Notes
          colWidths = [usable * 0.35, usable * 0.1, usable * 0.12, usable * 0.43]
        } else if (numCols === 3) {
          colWidths = [usable * 0.4, usable * 0.15, usable * 0.45]
        } else {
          colWidths = rows[0].map(() => usable / numCols)
        }

        // Measure row heights (wrap text in each cell)
        const rowData = rows.map(cells => {
          const wrapped = cells.map((cell, ci) => {
            doc.setFontSize(fontSize)
            return doc.splitTextToSize(cell, colWidths[ci] - cellPad * 2) as string[]
          })
          const h = Math.max(...wrapped.map(w => w.length)) * cellLH + cellPad * 2
          return { cells, wrapped, height: Math.max(h, 8) }
        })

        // Total table height — if it won't fit, start a new page
        const totalH = rowData.reduce((s, r) => s + r.height, 0)
        if (totalH < ph - footerH - mx) newPageIfNeeded(totalH + 4)

        for (let ri = 0; ri < rowData.length; ri++) {
          const rd = rowData[ri]
          const isHeader = ri === 0
          newPageIfNeeded(rd.height + 1)

          let cx = mx
          for (let ci = 0; ci < numCols; ci++) {
            const cw = colWidths[ci]

            // Cell background
            if (isHeader) {
              doc.setFillColor(13, 27, 42)
              doc.rect(cx, y, cw, rd.height, 'F')
            } else if (ri % 2 === 0) {
              doc.setFillColor(248, 249, 250)
              doc.rect(cx, y, cw, rd.height, 'F')
            }

            // Cell border
            doc.setDrawColor(220, 223, 228)
            doc.rect(cx, y, cw, rd.height, 'S')

            // Cell text
            doc.setFontSize(fontSize)
            doc.setFont('helvetica', isHeader ? 'bold' : 'normal')
            doc.setTextColor(isHeader ? 255 : 33, isHeader ? 255 : 37, isHeader ? 255 : 41)
            const textY = y + cellPad + cellLH * 0.7
            doc.text(rd.wrapped[ci] || [''], cx + cellPad, textY)

            cx += cw
          }
          y += rd.height
        }
        y += 4
        break
      }
    }
  }

  // ── footer on every page ───────────────────────────────────────────────────
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(220, 223, 228)
    doc.line(mx, ph - footerH + 2, pw - mx, ph - footerH + 2)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(155, 170, 184)
    doc.text(
      `Ideal Direct  ·  AI Assessment Analysis  ·  ${candidateName}`,
      mx, ph - 8,
    )
    doc.text(`Page ${i} of ${pages}`, pw - mx, ph - 8, { align: 'right' })
  }

  doc.save(`${candidateName.replace(/\s+/g, '_')}_Assessment_Analysis.pdf`)
}

function extractScore(analysis: string | undefined): { score: number | null; pass: boolean | null } {
  if (!analysis) return { score: null, pass: null }
  // Look for TOTAL row in the score table: | **TOTAL** | **100** | **72** |
  const totalMatch = analysis.match(/\|\s*\*{0,2}TOTAL\*{0,2}\s*\|\s*\*{0,2}100\*{0,2}\s*\|\s*\*{0,2}(\d+(?:\.\d+)?)\*{0,2}\s*\|/)
  const score = totalMatch ? parseFloat(totalMatch[1]) : null
  // Look for PASS/FAIL
  const resultMatch = analysis.match(/Result:\s*\*{0,2}(PASS|FAIL)\*{0,2}/i)
  const pass = resultMatch ? resultMatch[1].toUpperCase() === 'PASS' : (score !== null ? score >= 65 : null)
  return { score, pass }
}

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
              <div className="text-white font-black text-lg">Ideal Direct — Recruiter Portal</div>
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
        {activeTab === 'candidates'  && <CandidatesTab candidates={candidates} submissions={submissions} onRefresh={() => router.refresh()} />}
        {activeTab === 'submissions' && <SubmissionsTab submissions={submissions} candidates={candidates} />}
        {activeTab === 'resources'   && <ResourcesTab />}
        {activeTab === 'add'         && <AddCandidateTab onAdded={() => { router.refresh(); setActiveTab('candidates') }} />}
      </main>
    </div>
  )
}

// ── Candidates Tab ────────────────────────────────────────────────────────────
function CandidatesTab({ candidates, submissions, onRefresh }: { candidates: CandidateRecord[]; submissions: Submission[]; onRefresh: () => void }) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  async function removeCandidate(code: string) {
    if (!confirm('Are you sure you want to remove this candidate? This cannot be undone.')) return
    setDeleting(code)
    try {
      await fetch('/api/recruiter/delete-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      onRefresh()
    } catch {} finally { setDeleting(null) }
  }

  async function setStatus(code: string, status: 'active' | 'rejected' | 'interview') {
    setUpdating(code)
    try {
      await fetch('/api/recruiter/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, status }),
      })
      onRefresh()
    } catch {} finally { setUpdating(null) }
  }

  const getProgressStatus = (c: CandidateRecord) => {
    if (c.submittedAt) return { label:'Submitted', cls:'bg-[#D5F5E3] text-[#1E8449] border-[#27AE60]' }
    if (c.startedAt)   return { label:'In Progress', cls:'bg-[#FEF9E7] text-[#D4A017] border-[#F39C12]' }
    return { label:'Not Started', cls:'bg-[#F4F6F8] text-[#6B7A8D] border-[#E8EBF0]' }
  }

  const active    = candidates.filter(c => !c.status || c.status === 'active')
  const interview = candidates.filter(c => c.status === 'interview')
  const rejected  = candidates.filter(c => c.status === 'rejected')

  function renderCandidate(c: CandidateRecord) {
    const st = getProgressStatus(c)
    const subCount = submissions.filter(s => s.candidateCode === c.code).length
    const isUpdating = updating === c.code
    const candidateStatus = c.status || 'active'

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
        <div className="flex items-center gap-4">
          <div className="text-center hidden lg:block">
            <div className="text-xs text-[#6B7A8D]">Code</div>
            <div className="font-mono font-bold text-[#0D1B2A] text-sm tracking-widest">{c.code}</div>
          </div>
          <div className="text-center hidden md:block">
            <div className="text-xs text-[#6B7A8D]">Submissions</div>
            <div className="font-bold text-[#0D1B2A] text-sm">{subCount}</div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${st.cls}`}>{st.label}</span>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {candidateStatus !== 'interview' && (
              <button
                onClick={() => setStatus(c.code, 'interview')}
                disabled={isUpdating}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#EAF2FB] text-[#1A5276] border border-[#2471A3] hover:bg-[#2471A3] hover:text-white transition-colors disabled:opacity-40"
              >
                {isUpdating ? '...' : 'Interview'}
              </button>
            )}
            {candidateStatus !== 'rejected' && (
              <button
                onClick={() => setStatus(c.code, 'rejected')}
                disabled={isUpdating}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#FDF2F2] text-[#C0392B] border border-[#E74C3C] hover:bg-[#C0392B] hover:text-white transition-colors disabled:opacity-40"
              >
                {isUpdating ? '...' : 'Reject'}
              </button>
            )}
            {candidateStatus !== 'active' && (
              <button
                onClick={() => setStatus(c.code, 'active')}
                disabled={isUpdating}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#F4F6F8] text-[#6B7A8D] border border-[#E8EBF0] hover:bg-[#6B7A8D] hover:text-white transition-colors disabled:opacity-40"
              >
                {isUpdating ? '...' : 'Restore'}
              </button>
            )}
            <button
              onClick={() => removeCandidate(c.code)}
              disabled={deleting === c.code}
              className="text-xs text-[#6B7A8D] hover:text-[#C0392B] transition-colors disabled:opacity-40 ml-1"
              title="Remove candidate"
            >
              {deleting === c.code ? '...' : '✕'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderSection(title: string, items: CandidateRecord[], color: string, icon: string, emptyText?: string) {
    if (items.length === 0 && !emptyText) return null
    return (
      <div className="bg-white rounded-lg border border-[#E8EBF0] overflow-hidden">
        <div className={`px-6 py-3 border-b border-[#E8EBF0] ${color}`}>
          <h2 className="font-bold text-sm">{icon} {title} ({items.length})</h2>
        </div>
        {items.length === 0 ? (
          <div className="px-6 py-8 text-center text-[#6B7A8D] text-sm">{emptyText}</div>
        ) : (
          <div className="divide-y divide-[#E8EBF0]">
            {items.map(renderCandidate)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {renderSection('Request for Interview', interview, 'bg-[#EAF2FB] text-[#1A5276]', '🎯')}
      {renderSection('Active Candidates', active, 'bg-[#F4F6F8] text-[#0D1B2A]', '👥', 'No candidates yet. Use "Add Candidate" to create access codes.')}
      {renderSection('Rejected', rejected, 'bg-[#FDF2F2] text-[#922B21]', '✗')}
    </div>
  )
}

// ── Submissions Tab ───────────────────────────────────────────────────────────
function SubmissionsTab({ submissions, candidates }: { submissions: Submission[]; candidates: CandidateRecord[] }) {
  const [selected, setSelected] = useState<Submission | null>(null)
  const [analysisTarget, setAnalysisTarget] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  function viewExistingAnalysis(candidateCode: string) {
    const candidate = candidates.find(c => c.code === candidateCode)
    if (candidate?.aiAnalysis) {
      setAnalysisTarget(candidateCode)
      setAnalysis(candidate.aiAnalysis)
    }
  }

  async function runAnalysis(candidateCode: string) {
    setAnalysisTarget(candidateCode)
    setAnalysis(null)
    setAnalysisError('')
    setAnalysisLoading(true)
    try {
      const res = await fetch('/api/recruiter/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateCode }),
      })
      const data = await res.json()
      if (res.ok) {
        setAnalysis(data.analysis)
      } else {
        setAnalysisError(data.error || 'Analysis failed')
      }
    } catch { setAnalysisError('Something went wrong.') }
    finally { setAnalysisLoading(false) }
  }

  // AI Analysis view
  if (analysisTarget) {
    const candidate = candidates.find(c => c.code === analysisTarget)
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <button onClick={() => { setAnalysisTarget(null); setAnalysis(null) }} className="text-sm text-[#C0392B] hover:underline font-bold">← Back to submissions</button>
        <div className="bg-white rounded-lg border border-[#E8EBF0] overflow-hidden">
          <div className="bg-[#0D1B2A] px-6 py-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold tracking-widest text-[#C0392B] uppercase">AI Assessment Analysis</div>
              <div className="text-white font-bold text-lg">{candidate?.name || analysisTarget}</div>
              <div className="text-[#6B7A8D] text-xs mt-0.5">{candidate?.email}</div>
            </div>
            <div className="flex items-center gap-4">
              {analysis && (() => {
                const { score, pass } = extractScore(analysis)
                if (score === null) return null
                return (
                  <div className="text-right">
                    <div className="text-white font-black text-2xl">{score}<span className="text-sm font-normal text-[#6B7A8D]"> / 100</span></div>
                    <div className={`text-xs font-bold ${pass ? 'text-[#27AE60]' : 'text-[#E74C3C]'}`}>{pass ? 'PASS' : 'FAIL'}</div>
                  </div>
                )
              })()}
              {analysis && (
                <div className="flex gap-2">
                  <button onClick={() => downloadAnalysisPdf(candidate?.name || 'Candidate', candidate?.email || '', analysis)} className="text-xs text-white bg-[#C0392B] hover:bg-[#A93226] px-3 py-1.5 rounded font-bold transition-colors">
                    Download PDF
                  </button>
                  <button onClick={() => runAnalysis(analysisTarget)} className="text-xs text-[#6B7A8D] hover:text-white border border-[#243E59] hover:border-[#6B7A8D] px-3 py-1.5 rounded transition-colors">
                    Re-analyse
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="p-6">
            {analysisLoading && (
              <div className="flex items-center gap-3 py-12 justify-center">
                <div className="animate-spin w-5 h-5 border-2 border-[#C0392B] border-t-transparent rounded-full"></div>
                <div className="text-[#6B7A8D] text-sm">Analysing submissions against answer key... this may take 30-60 seconds</div>
              </div>
            )}
            {analysisError && (
              <div className="bg-[#FDF2F2] border border-[#E74C3C] rounded-lg px-4 py-3 text-[#C0392B] text-sm">{analysisError}</div>
            )}
            {analysis && (
              <div className="prose prose-sm max-w-none text-[#2C3E50]" dangerouslySetInnerHTML={{ __html: markdownToHtml(analysis) }} />
            )}
          </div>
        </div>
      </div>
    )
  }

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
                    ? <a href={`/api/recruiter/download?url=${encodeURIComponent(selected.fileUrl)}`} className="text-sm text-[#C0392B] hover:underline font-bold">↓ Download file</a>
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

  // Group submissions by candidate for the AI analyse button
  const candidateCodes = [...new Set(submissions.map(s => s.candidateCode))]

  return (
    <div className="space-y-4">
      {/* Per-candidate analysis buttons */}
      {candidateCodes.length > 0 && (
        <div className="bg-white rounded-lg border border-[#E8EBF0] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E8EBF0] bg-[#0D1B2A]">
            <div className="text-[10px] font-bold tracking-widest text-[#C0392B] uppercase mb-1">AI Assessment Tool</div>
            <h2 className="font-bold text-white">Analyse candidate submissions against the answer key</h2>
          </div>
          <div className="divide-y divide-[#E8EBF0]">
            {candidateCodes.map(code => {
              const cSubs = submissions.filter(s => s.candidateCode === code)
              const name = cSubs[0]?.candidateName || code
              const candidate = candidates.find(c => c.code === code)
              const hasAnalysis = !!candidate?.aiAnalysis
              return (
                <div key={code} className="px-6 py-3 flex items-center justify-between hover:bg-[#FAFBFC]">
                  <div>
                    <div className="font-bold text-[#0D1B2A] text-sm">{name}</div>
                    <div className="text-xs text-[#6B7A8D]">
                      {cSubs.length} submission{cSubs.length !== 1 ? 's' : ''}
                      {hasAnalysis && <span className="ml-2 text-[#27AE60]">· Analysis saved {new Date(candidate.aiAnalysisAt!).toLocaleDateString('en-GB')}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {hasAnalysis && (
                      <button
                        onClick={() => viewExistingAnalysis(code)}
                        className="bg-[#27AE60] hover:bg-[#1E8449] text-white font-bold text-xs py-2 px-4 rounded-lg transition-colors"
                      >
                        View Analysis
                      </button>
                    )}
                    <button
                      onClick={() => runAnalysis(code)}
                      className="bg-[#0D1B2A] hover:bg-[#1A2E45] text-white font-bold text-xs py-2 px-4 rounded-lg transition-colors"
                    >
                      {hasAnalysis ? 'Re-analyse' : 'Analyse with AI'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
    </div>
  )
}

// Simple markdown → HTML converter for the AI analysis output
function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-black text-[#0D1B2A] mt-6 mb-2 border-b border-[#E8EBF0] pb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-[#0D1B2A] mt-4 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim())
      if (cells.every(c => /^[\s-:]+$/.test(c))) return '' // separator row
      const tag = cells.some(c => /^[\s-]+$/.test(c)) ? 'td' : 'td'
      return '<tr>' + cells.map(c => `<${tag} class="border border-[#E8EBF0] px-3 py-2 text-sm">${c.trim()}</${tag}>`).join('') + '</tr>'
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, (match) => `<table class="w-full border-collapse border border-[#E8EBF0] my-4">${match}</table>`)
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm leading-relaxed">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="list-disc pl-4 space-y-1 my-2">${match}</ul>`)
    .replace(/\n{2,}/g, '</p><p class="text-sm leading-relaxed mb-3">')
    .replace(/^(?!<)(.+)$/gm, '<p class="text-sm leading-relaxed mb-3">$1</p>')
    .replace(/<p class="text-sm leading-relaxed mb-3"><\/p>/g, '')
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
  const [result, setResult] = useState<{ code: string; name: string; email: string; emailSent: boolean } | null>(null)

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
        setResult({ code: data.code, name, email, emailSent: data.emailSent })
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
          {result.emailSent ? (
            <div className="text-sm text-[#1E8449] mt-3">✉️ Access code emailed to <strong>{result.email}</strong></div>
          ) : (
            <div className="text-sm text-[#6B7A8D] mt-3">⚠ Email not sent — share the code manually</div>
          )}
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
