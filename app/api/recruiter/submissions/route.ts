import { NextResponse } from 'next/server'
import { requireRecruiterSession } from '@/lib/auth'
import { listAllSubmissions } from '@/lib/db'

export async function GET() {
  const session = await requireRecruiterSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const submissions = await listAllSubmissions()
  return NextResponse.json(submissions)
}
