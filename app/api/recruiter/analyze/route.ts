import { NextRequest, NextResponse } from 'next/server'
import { requireRecruiterSession } from '@/lib/auth'
import { getSubmissionsForCandidate, getCandidate, updateCandidate } from '@/lib/db'
import { readFileSync } from 'fs'
import { join } from 'path'
import Anthropic from '@anthropic-ai/sdk'

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

SECTION 1 — ACCOUNT-LEVEL ANALYSIS (15 marks):
- BX-009 CVR 7.3% lowest by 5.4pp (2 marks)
- BX-009 TACoS 86.0% (£1,590 spend vs £1,850 revenue) (3 marks)
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
- Blended ACoS 54.5% (£1,590÷£2,920), TACoS 86.0% (£1,590÷£1,850) (3 marks)
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

  // Gather all submission text
  const adsSubmissions = submissions
    .filter(s => s.task === 'ads')
    .map(s => s.content || `[File submission: ${s.fileName}]`)
    .join('\n\n---\n\n')

  const listingsSubmissions = submissions
    .filter(s => s.task === 'listings')
    .map(s => s.content || `[File submission: ${s.fileName}]`)
    .join('\n\n---\n\n')

  const answerKey = getAnswerKeySummary()

  let analysisText: string
  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `You are a senior Amazon advertising assessor for Ideal Direct. You have received a candidate's assessment submission and the official answer key. Your job is to produce a professional, comprehensive analysis report.

ANSWER KEY (with marks per finding):
${answerKey}

CANDIDATE: ${candidate.name}
EMAIL: ${candidate.email}

CANDIDATE'S TASK 1 SUBMISSION (Advertising Analysis — Sections 1-5):
${adsSubmissions || '[No submission for Task 1]'}

CANDIDATE'S TASK 2 SUBMISSION (Listing Quality — Section 6):
${listingsSubmissions || '[No submission for Task 2]'}

Please produce a structured analysis report in this exact format:

## Overall Summary
2-3 sentence executive summary of the candidate's performance.

## Score Breakdown

| Section | Max | Awarded | Notes |
|---------|-----|---------|-------|
| 1 — Account-Level Analysis | 15 | X | Brief note |
| 2 — Obvious Waste | 20 | X | Brief note |
| 3 — Keyword Cannibalisation | 25 | X | Brief note |
| 4 — Under-Invested Opportunities | 15 | X | Brief note |
| 5 — BX-009 Root Cause | 15 | X | Brief note |
| 6 — Listing Quality | 10 | X | Brief note |
| **TOTAL** | **100** | **X** | |

## Result: PASS / FAIL (65 to pass)

## Detailed Analysis

For each section, list:
- What the candidate correctly identified (with their specific data points)
- What they missed (referencing the answer key)
- Quality of their recommendations
- Whether they used specific campaign IDs and figures (required for marks)

## Strengths
Bullet points of what the candidate did well.

## Areas for Improvement
Bullet points of what was missed or could be stronger.

## Hiring Recommendation
A final 2-3 sentence recommendation on whether to proceed with this candidate.

IMPORTANT SCORING RULES:
- Award 0 marks for vague observations without specific campaign IDs or figures
- Award 50% (partial credit) where the issue is correctly identified but evidence or fix is incomplete
- Be fair but rigorous — this is a professional assessment
- If submissions are file-only with no text content, note that the file could not be analysed and score conservatively`,
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
