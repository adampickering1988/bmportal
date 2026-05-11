import { NextRequest, NextResponse } from 'next/server'
import { requireRecruiterSession } from '@/lib/auth'
import { getSubmissionsForCandidate, getCandidate, updateCandidate, type Submission } from '@/lib/db'
import { readFileSync } from 'fs'
import { join } from 'path'
import Anthropic from '@anthropic-ai/sdk'

// Extract text from an uploaded file (docx or plain text)
async function extractFileText(sub: Submission): Promise<string> {
  if (!sub.fileUrl) return `[File: ${sub.fileName} — no URL available]`

  try {
    // Download the file from Vercel Blob
    const res = await fetch(sub.fileUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    })
    if (!res.ok) return `[File: ${sub.fileName} — download failed (${res.status})]`

    const buffer = Buffer.from(await res.arrayBuffer())
    const name = (sub.fileName || '').toLowerCase()

    // .docx — extract text from the XML inside the zip
    if (name.endsWith('.docx')) {
      try {
        const AdmZip = require('adm-zip')
        const zip = new AdmZip(buffer)
        const docXml = zip.readAsText('word/document.xml')
        const text = docXml
          .replace(/<w:p[\s>]/g, '\n<w:p ')        // paragraph breaks
          .replace(/<w:tab\/>/g, '\t')               // tabs
          .replace(/<[^>]+>/g, '')                   // strip all XML tags
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/\n{3,}/g, '\n\n')                // collapse blank lines
          .trim()
        return text || `[File: ${sub.fileName} — empty document]`
      } catch (e: any) {
        return `[File: ${sub.fileName} — failed to parse docx: ${e.message}]`
      }
    }

    // .xlsx / .xls — spreadsheet
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      try {
        const XLSX = require('xlsx')
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const parts: string[] = []
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
          if (csv.trim()) {
            parts.push(`--- Sheet: ${sheetName} ---\n${csv}`)
          }
        }
        const text = parts.join('\n\n')
        return text || `[File: ${sub.fileName} — empty spreadsheet]`
      } catch (e: any) {
        return `[File: ${sub.fileName} — failed to parse xlsx: ${e.message}]`
      }
    }

    // .txt — plain text
    if (name.endsWith('.txt')) {
      return buffer.toString('utf-8')
    }

    // .pdf — handled by Claude's native document support, not text extraction.
    // Mark with a placeholder so the caller knows to attach the PDF instead.
    if (name.endsWith('.pdf')) {
      return `[PDF:${sub.fileName}]`
    }

    return `[File: ${sub.fileName} — unsupported format for text extraction]`
  } catch (e: any) {
    return `[File: ${sub.fileName} — error: ${e.message}]`
  }
}

const MAX_FILE_TEXT_CHARS = 60000 // ~15k tokens, generous but bounded

async function extractFileTextBounded(sub: Submission): Promise<string> {
  const text = await extractFileText(sub)
  if (text.length > MAX_FILE_TEXT_CHARS) {
    return text.slice(0, MAX_FILE_TEXT_CHARS) + `\n\n[File truncated — ${text.length} chars total, showing first ${MAX_FILE_TEXT_CHARS}]`
  }
  return text
}

// Extract text from the answer key docx at build/runtime
function getAnswerKeyText(): string {
  try {
    const AdmZip = require('adm-zip')
    const zipPath = join(process.cwd(), 'public', 'assets', 'answer-key.docx')
    const zip = new AdmZip(zipPath)
    const docXml = zip.readAsText('word/document.xml')
    // Simple XML text extraction
    return docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  } catch {
    // Fallback: read the raw file as base64 won't work, so return a note
    return '[Answer key could not be parsed — analysis will proceed with general criteria]'
  }
}

// Pre-extracted answer key for reliability (extracted during development)
function getAnswerKeySummary(): string {
  return `
BRAND X ASSESSMENT — ANSWER KEY & MARKING GUIDE (100 MARKS, PASS: 65)

DATA SOURCES OF TRUTH:
- Ad Campaign Report: source of truth for per-campaign spend, sales, ACoS, impressions, clicks
- Dashboard: source of truth for Total Revenue per SKU (includes organic + ad-attributed)
- ACoS = Ad Spend ÷ Ad Sales (use campaign report sums)
- TACoS = Ad Spend ÷ Total Revenue (use dashboard revenue)

SECTION 1 — ACCOUNT-LEVEL ANALYSIS (15 marks):
- BX-009 CVR 7.3% lowest by 5.4pp (2 marks)
- BX-009 TACoS 43.0% (£1,590 spend vs £3,700 total revenue) — more than 2x next-highest SKU (3 marks)
- CPG-001-02 Immune Phrase ACoS 64.2%, spend £1,040 — worst SP campaign (2 marks)
- CPG-007-04 MensMV Broad ACoS 55.6%, 'multivitamin for dogs' visible (2 marks)
- SD campaigns avg 53.2% ACoS vs SB/SBV 19.3% — type-level pattern (3 marks)
- CPG-003-04 ROAS 5.65x and CPG-001-04 ROAS 5.08x — under-resourced best campaigns (3 marks)

SECTION 2 — IRRELEVANT SEARCH TERMS / OBVIOUS WASTE (20 marks):
- 'collagen gummies' CPG-003-02 Broad, ACoS 68.3%, wrong format, negate 'gummies' (6 marks)
- 'magnesium for horses' CPG-005-02 Phrase, ACoS 258.6%, £362=38.5% of campaign spend, campaign ACoS drops to ~31.8% without it (9 marks)
- 'multivitamin for dogs' CPG-007-04 Broad, ACoS 675.0%, £540=39.1% of spend, negate 'dogs'/'dog'/'pet' (7 marks)
- 'vitamin c serum face' + 'vitamin c tablets children' CPG-001-02 Phrase, combined £710 of £1,040 (68.3%), valid term already in CPG-001-01 Exact (8 marks)

SECTION 3 — KEYWORD CANNIBALISATION (25 marks):
- 'collagen peptides uk' CPG-003-01 Exact (25.1%) vs CPG-003-02 Broad (49.2%), Rank 1, TOS 76%, negate from Broad (11 marks)
- 'magnesium glycinate' CPG-005-01 Exact (22.9%) vs CPG-005-02 Phrase (44.7%), Phrase spends £150 more for £280 less, negate from Phrase (11 marks)
- 'biotin 10000mcg' CPG-010-01 SP Exact (24.5%, TOS 78%, mult 60%) vs CPG-010-02 SB Brand (16.0%, TOS 85%, mult 65%), Rank 2, reduce SP TOS mult to 30-35% (12 marks)

SECTION 4 — UNDER-INVESTED OPPORTUNITIES (15 marks):
- 'vitamin c supplement' Rank 3, MSV 88,000, ACoS 23.1%, TOS mult 40% → increase to 50-55% (7 marks)
- 'mens multivitamin' Rank 2, MSV 64,000, ACoS 24.1%, TOS mult 50% → increase to 55-60% (6 marks)
- 'magnesium supplement uk' Rank 7, MSV 72,000, ACoS 22.0%, TOS mult 30% → increase to 45-55%, fix cannibalisation first (6 marks)
- Budget reallocation: pause CPG-001-03 (£720, 69.2%) + CPG-007-02 (£380, 56.9%), redirect £1,100 to CPG-003-04 + CPG-001-04 (6 marks)

SECTION 5 — BX-009 ROOT CAUSE DIAGNOSIS (15 marks):
- Root cause is CVR 7.3% (lowest by 5.4pp), NOT a bidding problem (3 marks)
- Blended ACoS 54.5% (£1,590÷£2,920 ad sales), TACoS 43.0% (£1,590÷£3,700 total revenue) (3 marks)
- TOS 52% with rank 18 on 62k MSV term — TOS/bid increases can't fix CVR (3 marks)
- Pause CPG-009-02 (£560), 03 (£480), 04 (£240) = £1,280 saved, retain 01 Exact only (3 marks)
- Flag 'turmeric gummies' wrong format, ACoS 60.0%, £192 (3 marks)

SECTION 6 — LISTING QUALITY (10 marks):
BX-009 (4 marks): Title 'Turmeric' x4 stuffing; Bullet 1 generic vs specific Bullet 2; prohibited health claims in Bullet 4 + description; backend keywords 68/250 bytes
BX-011 (3 marks): Title 'Vitamins' x3 + 'Energy' x2 stuffing; Bullet 2 vague wellness claim; Bullet 5 repeats Bullet 4; A+ table wrong comparison frame; no count variation
BX-012 (3 marks): 50ct child ASIN suppressed (not stockout); zinc compound form missing everywhere; Title 'Zinc' x5 stuffing

BONUS (up to 5 marks): Harvest opportunities (collagen supplement women, magnesium tablets 400mg, complete mens vitamin), structural issues (CPG-007-02 vs 03 same competitors, biotin phrase vs exact)

MARKING RULES: Require specific campaign IDs and figures. Vague observations = 0. Partial credit 50% where issue identified but evidence/fix incomplete.
`
}

export async function POST(req: NextRequest) {
  const session = await requireRecruiterSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const { candidateCode } = await req.json()
  if (!candidateCode) return NextResponse.json({ error: 'candidateCode required' }, { status: 400 })

  const candidate = await getCandidate(candidateCode)
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  const submissions = await getSubmissionsForCandidate(candidateCode)
  if (submissions.length === 0) {
    return NextResponse.json({ error: 'No submissions to analyse' }, { status: 400 })
  }

  // Gather all submission text — extract content from uploaded files
  const adsSubs = submissions.filter(s => s.task === 'ads')
  const listingSubs = submissions.filter(s => s.task === 'listings')

  // Collect PDFs to attach as native Claude document blocks (Claude can read
  // PDF content natively — including Adobe-generated compressed ones — far
  // more reliably than any Node-side text extractor).
  const pdfAttachments: { task: 'ads'|'listings'; fileName: string; base64: string }[] = []

  async function downloadPdfBase64(url: string): Promise<string | null> {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } })
      if (!r.ok) return null
      const buf = Buffer.from(await r.arrayBuffer())
      return buf.toString('base64')
    } catch { return null }
  }

  async function getSubmissionContent(s: Submission): Promise<string> {
    const parts: string[] = []
    if (s.type === 'file' && s.fileUrl) {
      const isPdf = (s.fileName || '').toLowerCase().endsWith('.pdf')
      if (isPdf) {
        const b64 = await downloadPdfBase64(s.fileUrl)
        if (b64) {
          pdfAttachments.push({ task: s.task, fileName: s.fileName || 'submission.pdf', base64: b64 })
          parts.push(`[PDF attached separately: ${s.fileName}]`)
        } else {
          parts.push(`[PDF: ${s.fileName} — download failed]`)
        }
      } else {
        parts.push(await extractFileTextBounded(s))
      }
    }
    if (s.content && s.content.trim()) {
      parts.push(`[Typed text by candidate]: ${s.content}`)
    }
    return parts.length > 0 ? parts.join('\n\n') : '[Empty submission]'
  }

  const adsTexts = await Promise.all(adsSubs.map(getSubmissionContent))
  const adsSubmissions = adsTexts.join('\n\n---\n\n')

  const listingsTexts = await Promise.all(listingSubs.map(getSubmissionContent))
  const listingsSubmissions = listingsTexts.join('\n\n---\n\n')

  // Candidates sometimes put both tasks in a single file but submit it under
  // just one task. If a task has NO submissions but the other does, treat ALL
  // files as potentially containing content for both tasks — Claude will read
  // them and figure out which sections are addressed where.
  const adsHasContent = adsSubs.length > 0
  const listingsHasContent = listingSubs.length > 0
  const onlyOneTaskSubmitted = adsHasContent !== listingsHasContent
  const combinedFileNote = onlyOneTaskSubmitted ? `
NOTE — POSSIBLE COMBINED SUBMISSION:
The candidate only submitted under one task (${adsHasContent ? 'Task 1: Advertising Analysis' : 'Task 2: Listing Quality'}). However, candidates sometimes put BOTH tasks in a single file and only upload it under one task label. Please carefully READ the attached files (especially PDFs and spreadsheets) — if they contain analysis for the other task as well, score BOTH tasks based on what you find in the file. Do not give a candidate zero on a task just because their file was tagged under the other task; assess based on the actual content.
` : ''

  const answerKey = getAnswerKeySummary()

  // The Dashboard data was corrected on 2026-05-11 around 13:00 UTC.
  // Candidates who started before that worked with an inconsistent dashboard
  // (banner totals didn't match SKU rows, Ad Spend per SKU didn't match
  // Ad Campaign Report sums, BX-009 Revenue < Ad Sales, etc.). When analysing
  // their work the AI needs to know this so it doesn't penalise correct
  // analyses that used the campaign-level data as source of truth, and so it
  // credits candidates who explicitly flagged the inconsistencies.
  const DATA_FIX_CUTOFF = '2026-05-11T13:00:00.000Z'
  const usedOldData =
    candidate.startedAt && candidate.startedAt < DATA_FIX_CUTOFF

  const dataVersionNote = usedOldData ? `
⚠ IMPORTANT — THIS CANDIDATE WORKED WITH AN EARLIER (INCONSISTENT) DASHBOARD:
This candidate started the assessment on ${candidate.startedAt} BEFORE the spreadsheet was corrected. The version they downloaded had real data integrity issues on the Dashboard tab:
- Banner totals (Revenue £39,160 / Ad Spend £8,444) did NOT match the SKU row sums (£40,160 / £5,840)
- Dashboard Ad Spend per SKU did NOT match the sum of campaigns in the Ad Campaign Report
- Dashboard BX-009 Revenue (£1,850) was LESS than BX-009's ad-attributed sales (£2,920), which is impossible
- The original answer key used the (impossible) BX-009 TACoS of 86%

Therefore when scoring this candidate:
1. CREDIT them generously if they explicitly noticed and flagged any of these inconsistencies — that's exceptional analytical attention
2. If they recalculated metrics from the Ad Campaign Report as the source of truth, accept their numbers
3. Do NOT penalise them for "missing" the 86% TACoS finding — that was based on broken data; the corrected TACoS is 43% on the new data
4. Their analysis of campaign-level findings (cannibalisation, irrelevant search terms, opportunities) is unaffected — those came from the Ad Campaign Report and Search Term Report, which were always consistent
` : ''


  let analysisText: string
  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            // Attach any PDF submissions natively — Claude reads them directly
            ...pdfAttachments.map(pdf => ({
              type: 'document' as const,
              source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: pdf.base64 },
              title: `${pdf.task === 'ads' ? 'Task 1 (Ads)' : 'Task 2 (Listings)'}: ${pdf.fileName}`,
            })),
            { type: 'text' as const, text: `You are a senior Amazon advertising assessor for Ideal Direct. You have received a candidate's assessment submission and the official answer key. Your job is to produce a professional, comprehensive analysis report.

NOTE ON DATA VERSION:
An earlier version of the spreadsheet had internal inconsistencies in the Dashboard (banner totals didn't match SKU rows; Ad Spend column didn't match Ad Campaign Report sums). Some candidates may have correctly identified these inconsistencies in their submissions — this should be CREDITED as strong analytical attention to detail, not penalised. If a candidate flags data integrity issues with specific examples, treat that as a positive signal of rigor.
${dataVersionNote}
${combinedFileNote}

IMPORTANT CONTEXT ON HOW TO USE THE ANSWER KEY:
The answer key below is a GUIDE to the quality and depth expected — it is NOT a literal checklist. Candidates do NOT need to identify the exact same findings, use the exact same figures, or reach the exact same conclusions as the answer key to score well. What matters is:

1. QUALITY OF THINKING — Does the candidate demonstrate strong analytical reasoning? Do they identify meaningful patterns and issues in the data, even if different from the answer key's examples?
2. EVIDENCE-BASED ANALYSIS — Are their observations supported by specific data points, campaign IDs, and figures from the source material? Vague generalisations without evidence score poorly.
3. ACTIONABLE RECOMMENDATIONS — Do they provide clear, specific, implementable recommendations? Not just "optimise this campaign" but concrete actions with rationale.
4. COMMERCIAL AWARENESS — Do they understand what the numbers mean for the business? Do they prioritise by impact?
5. DEPTH AND THOROUGHNESS — Have they engaged meaningfully with the data, or have they been superficial?

A candidate who identifies different issues from the answer key but supports them with solid data and reasoning should score WELL. A candidate who parrots answer-key-style findings without understanding or evidence should score POORLY. Judge the quality of their thinking, not whether they found the exact same things.

ANSWER KEY (use as a quality benchmark, not a literal scoring rubric):
${answerKey}

CANDIDATE: ${candidate.name}
EMAIL: ${candidate.email}

CANDIDATE'S TASK 1 SUBMISSION (Advertising Analysis — Sections 1-5):
${adsSubmissions || '[No submission for Task 1]'}

CANDIDATE'S TASK 2 SUBMISSION (Listing Quality — Section 6):
${listingsSubmissions || '[No submission for Task 2]'}

Please produce a structured analysis report in this exact format:

## Overall Summary
2-3 sentence executive summary of the candidate's performance, focusing on their analytical quality and commercial thinking.

## Score Breakdown

| Section | Max | Awarded | Notes |
|---------|-----|---------|-------|
| 1 — Account-Level Analysis | 15 | X | Brief note |
| 2 — Waste Identification & Negatives | 20 | X | Brief note |
| 3 — Cannibalisation & Overlap | 25 | X | Brief note |
| 4 — Growth Opportunities | 15 | X | Brief note |
| 5 — BX-009 Diagnosis | 15 | X | Brief note |
| 6 — Listing Quality | 10 | X | Brief note |
| **TOTAL** | **100** | **X** | |

## Result: PASS / FAIL (65 to pass)

## Detailed Analysis

For each section, assess:
- The quality of the candidate's analytical thinking and observations
- Whether their points are well-supported with specific data (campaign IDs, figures, percentages)
- The strength and specificity of their recommendations
- Any particularly impressive insights or notable gaps
- Credit valid findings even if they differ from the answer key's specific examples

## Strengths
Bullet points of what the candidate did well — highlight strong analytical thinking, good use of data, creative insights, or commercial awareness.

## Areas for Improvement
Bullet points of what was missed or could be stronger — focus on gaps in thinking or methodology, not just "didn't mention X from the answer key."

## AI Usage Likelihood: X/10

Assess how likely it is that the candidate used AI (ChatGPT, Claude, etc.) to write their submission. Output a single line in this exact format:

**AI Likelihood Score: X/10** — where 0 = clearly human-written under pressure, 10 = almost certainly AI-generated.

Then provide 3-6 bullet points of specific evidence, citing exact phrases or patterns from their submission.

**Signals suggesting AI use (raise the score):**
- Overly polished, uniform prose throughout — no fatigue, no rushed sections
- Generic phrasing not tied to specific data (e.g. "leverage opportunities", "robust strategies", "comprehensive analysis")
- Em-dashes used as punctuation, em-dash + adverb patterns ("not only X — but also Y")
- AI tells: "delve into", "moreover", "furthermore", "in conclusion", "it is important to note", "navigate the complexities", "robust", "leverage", "comprehensive", "holistic", "synergy"
- Perfectly structured headings/subheadings throughout, consistent bullet formatting
- Length and breadth that exceeds what a stressed human can write in 90 minutes (rough rule: > 2,500 words of polished prose is suspicious)
- Hedging/disclaimer language unusual for a working professional ("It is worth considering...", "One could argue that...")
- Vague recommendations without specific campaign IDs or numbers, even though they reference the data
- US English spelling/vocabulary when the candidate is UK-based (assessment is UK)
- Repeating the same idea in different words (AI tends to pad)

**Signals suggesting genuine human work (lower the score):**
- Specific campaign IDs (CPG-XXX-XX) cited inline with figures
- Calculations shown with workings (e.g. £540 ÷ £1,380 = 39%)
- Typos, casual abbreviations, sentence fragments, notes-to-self
- Uneven depth across sections (some thorough, some rushed — humans run out of time)
- Personal voice ("I'd recommend", "my take is", "I noticed")
- Specific reasoning that connects multiple data points across sheets
- Realistic length for 90 minutes (typically 1,000-2,000 words for analysis tasks)
- Honest gaps or "I would also want to check..." statements

**Important calibration:**
- 0-2: Clearly human, possibly even rough. Typos, specific figures, uneven sections.
- 3-4: Mostly human with possible AI polish or AI used for editing. Real reasoning visible.
- 5-6: Mixed signals. Some sections feel AI-generated, others feel human, or candidate may have used AI to assist with structure.
- 7-8: Likely AI-generated with some human editing/personalisation. Generic phrasing dominates.
- 9-10: Almost certainly AI. Consistent AI tone throughout, generic, lacks specific data anchoring even when data is available.

Be calibrated — most candidates will fall in the 2-5 range. Save high scores for genuinely suspicious work. Lower a score if you spot ANY of: typos, specific campaign IDs with figures, personal voice, uneven section depth.

## Hiring Recommendation
A final 2-3 sentence recommendation on whether to proceed with this candidate, based on their overall analytical capability AND your AI likelihood assessment. If AI likelihood is 7+, flag this in the recommendation.

SCORING APPROACH:
- Award marks based on the QUALITY of analysis, not exact match to answer key findings
- A well-reasoned observation with data support scores full marks even if the answer key lists a different finding for that section
- Vague observations without specific evidence (no campaign IDs, no figures) score poorly regardless of whether the point is valid
- Partial credit for identifying a real issue but not fully developing the analysis or recommendation
- Be fair and constructive — assess them as a potential colleague, not against a perfect-score rubric
- If submissions are file-only with no extractable text, note this and score conservatively
${pdfAttachments.length > 0 ? `\n${pdfAttachments.length} PDF submission${pdfAttachments.length > 1 ? 's are' : ' is'} attached to this message. Read them carefully — they contain the candidate's full analysis.` : ''}` },
          ],
        },
    ],
  })

    analysisText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
  } catch (err: any) {
    console.error('[analyze] Anthropic API error:', err?.message || err)
    return NextResponse.json({ error: `AI analysis failed: ${err?.message || 'Unknown error'}` }, { status: 500 })
  }

  // Persist the analysis on the candidate record
  try {
    await updateCandidate(candidateCode, {
      aiAnalysis: analysisText,
      aiAnalysisAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[analyze] Failed to persist analysis:', err?.message || err)
    // Still return the analysis even if persistence fails
  }

  return NextResponse.json({
    ok: true,
    analysis: analysisText,
    candidateName: candidate.name,
    candidateEmail: candidate.email,
    submissionCount: submissions.length,
  })
}
