import { redirect } from 'next/navigation'
import { requireCandidateSession } from '@/lib/auth'
import { enforceExpiry, getCandidate, getSubmissionsForCandidate, getTimerState, updateCandidate } from '@/lib/db'
import CandidatePortal from './CandidatePortal'

export default async function CandidatePage() {
  const session = await requireCandidateSession()
  if (!session) redirect('/')

  // Make sure startedAt is set the moment the candidate first lands here.
  // (Auth route also sets it, but this is a belt-and-braces guarantee.)
  const initial = await getCandidate(session.code)
  if (!initial) redirect('/')
  if (!initial.startedAt) {
    await updateCandidate(session.code, { startedAt: new Date().toISOString() })
  }

  // Run expiry check before rendering — finalises any drafts if 90 mins are up.
  await enforceExpiry(session.code)
  const candidate = await getCandidate(session.code)
  if (!candidate) redirect('/')

  const submissions = await getSubmissionsForCandidate(session.code)
  const timer = getTimerState(candidate)
  return (
    <CandidatePortal
      candidate={candidate}
      submissions={submissions}
      timer={timer}
    />
  )
}
