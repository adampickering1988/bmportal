import { NextResponse } from 'next/server'
import { requireCandidateSession } from '@/lib/auth'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  const session = await requireCandidateSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const file = readFileSync(join(process.cwd(), 'public/assets/performance-data.xlsx'))
  return new NextResponse(file, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="BrandX_Performance_Data.xlsx"',
    },
  })
}
