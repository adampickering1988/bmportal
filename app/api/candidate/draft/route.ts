import { NextRequest, NextResponse } from 'next/server'
import { requireCandidateSession } from '@/lib/auth'
import { enforceExpiry, getCandidate, getTimerState, updateCandidate } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await requireCandidateSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { task, content } = await req.json()
  if (task !== 'ads' && task !== 'listings') {
    return NextResponse.json({ error: 'Invalid task' }, { status: 400 })
  }

  // Enforce expiry first — once the timer is up, drafts are frozen.
  await enforceExpiry(session.code)
  const candidate = await getCandidate(session.code)
  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const timer = getTimerState(candidate)
  if (timer.expired) {
    return NextResponse.json({ error: 'Time expired', expired: true }, { status: 403 })
  }

  const update: Partial<{ draftAds: string; draftListings: string }> = {}
  if (task === 'ads') update.draftAds = String(content || '')
  if (task === 'listings') update.draftListings = String(content || '')
  await updateCandidate(session.code, update)

  return NextResponse.json({
    ok: true,
    secondsRemaining: timer.secondsRemaining,
  })
}
