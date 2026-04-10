import { NextResponse } from 'next/server'
import { requireCandidateSession } from '@/lib/auth'
import { enforceExpiry, getCandidate, getTimerState } from '@/lib/db'

export async function GET() {
  const session = await requireCandidateSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // If the timer has run out, finalise any drafts before returning state.
  await enforceExpiry(session.code)
  const candidate = await getCandidate(session.code)
  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const timer = getTimerState(candidate)
  return NextResponse.json({
    ...timer,
    autoSubmitted: candidate.autoSubmitted || false,
  })
}
