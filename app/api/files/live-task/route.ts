import { NextResponse } from 'next/server'
import { requireRecruiterSession } from '@/lib/auth'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  const session = await requireRecruiterSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const path = join(process.cwd(), 'public', 'assets', 'live-task-pillow.html')
  const html = readFileSync(path, 'utf-8')
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
