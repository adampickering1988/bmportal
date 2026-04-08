import { redirect } from 'next/navigation'
import { requireRecruiterSession } from '@/lib/auth'
import { listCandidates, listAllSubmissions } from '@/lib/db'
import RecruiterPortal from './RecruiterPortal'

export default async function RecruiterPage() {
  const session = await requireRecruiterSession()
  if (!session) redirect('/recruiter/login')
  const candidates = await listCandidates()
  const submissions = await listAllSubmissions()
  return <RecruiterPortal candidates={candidates} submissions={submissions} />
}
