import { NextResponse } from 'next/server'
import { requireCandidateSession } from '@/lib/auth'
import { readFileSync } from 'fs'
import { join } from 'path'

// Candidate codes allowed to see the live task. Add more here to enable for
// other candidates without redeploying logic.
const ALLOWED_CODES = ['22D7B6'] // Lisa Hoskins

export async function GET() {
  const session = await requireCandidateSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!ALLOWED_CODES.includes(session.code.toUpperCase())) {
    return NextResponse.json({ error: 'Not available for this candidate' }, { status: 403 })
  }
  const path = join(process.cwd(), 'public', 'assets', 'live-task-pillow.html')
  const html = readFileSync(path, 'utf-8')
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
