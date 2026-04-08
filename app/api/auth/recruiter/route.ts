import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== (process.env.RECRUITER_PASSWORD || 'IdealDirect2026')) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }
  const token = await signToken({ role: 'recruiter' })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 })
  return res
}
