import { redirect } from 'next/navigation'
import { requireCandidateSession } from '@/lib/auth'
import { getCandidate, getSubmissionsForCandidate } from '@/lib/db'
import CandidatePortal from './CandidatePortal'

export default async function CandidatePage() {
  const session = await requireCandidateSession()
  if (!session) redirect('/')
  const candidate = await getCandidate(session.code)
  if (!candidate) redirect('/')
  const submissions = await getSubmissionsForCandidate(session.code)
  return <CandidatePortal candidate={candidate} submissions={submissions} />
}
