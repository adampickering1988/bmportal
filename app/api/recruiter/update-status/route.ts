import { NextRequest, NextResponse } from 'next/server'
import { requireRecruiterSession } from '@/lib/auth'
import { getCandidate, updateCandidate } from '@/lib/db'

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

  await updateCandidate(code, { status, statusAt: new Date().toISOString() })
  return NextResponse.json({ ok: true })
}
