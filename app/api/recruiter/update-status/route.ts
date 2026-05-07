import { NextRequest, NextResponse } from 'next/server'
import { requireRecruiterSession } from '@/lib/auth'
import { getCandidate, updateCandidate } from '@/lib/db'
import { sendInterviewNotification, sendRejectionNotification } from '@/lib/email'

function extractScore(analysis: string | undefined): number | null {
  if (!analysis) return null
  const m = analysis.match(/\|\s*\*{0,2}TOTAL\*{0,2}\s*\|\s*\*{0,2}100\*{0,2}\s*\|\s*\*{0,2}(\d+(?:\.\d+)?)\*{0,2}\s*\|/)
  return m ? parseFloat(m[1]) : null
}

export async function POST(req: NextRequest) {
  const session = await requireRecruiterSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { code, status } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })
  if (!['active', 'rejected', 'interview'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const candidate = await getCandidate(code)
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  const previousStatus = candidate.status || 'active'
  await updateCandidate(code, { status, statusAt: new Date().toISOString() })

  // Send notification email to Cara — only when transitioning into a new state
  // (not when restoring or re-applying the same status).
  if (status !== previousStatus) {
    const score = extractScore(candidate.aiAnalysis)
    if (status === 'interview') {
      sendInterviewNotification(candidate.name, candidate.email, candidate.code, score)
        .catch(err => console.error('[update-status] Interview email failed:', err))
    } else if (status === 'rejected') {
      sendRejectionNotification(candidate.name, candidate.email, candidate.code, score)
        .catch(err => console.error('[update-status] Rejection email failed:', err))
    }
  }

  return NextResponse.json({ ok: true })
}
