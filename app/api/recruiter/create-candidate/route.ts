import { NextRequest, NextResponse } from 'next/server'
import { requireRecruiterSession } from '@/lib/auth'
import { createCandidate, getCandidate } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function POST(req: NextRequest) {
  const session = await requireRecruiterSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { name, email, customCode } = await req.json()
  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
  const code = customCode?.toUpperCase() || uuid().slice(0,6).toUpperCase()
  const existing = await getCandidate(code)
  if (existing) return NextResponse.json({ error: 'Code already in use' }, { status: 400 })
  await createCandidate({ code, name, email })
  return NextResponse.json({ ok: true, code })
}
