import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '@/lib/auth'
import { getCandidate, updateCandidate } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Access code required' }, { status: 400 })
  const candidate = await getCandidate(code.toUpperCase())
  if (!candidate) return NextResponse.json({ error: 'Invalid access code. Please check your invitation email.' }, { status: 401 })
  if (!candidate.startedAt) {
    await updateCandidate(code, { startedAt: new Date().toISOString() })
  }
  const token = await signToken({ role: 'candidate', code: candidate.code, name: candidate.name })
  const res = NextResponse.json({ ok: true, name: candidate.name })
  res.cookies.set('session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 8 })
  return res
}
