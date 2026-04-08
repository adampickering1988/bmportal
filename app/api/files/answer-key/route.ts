import { NextResponse } from 'next/server'
import { requireRecruiterSession } from '@/lib/auth'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  const session = await requireRecruiterSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const file = readFileSync(join(process.cwd(), 'public/assets/answer-key.docx'))
  return new NextResponse(file, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="BrandX_Answer_Key_CONFIDENTIAL.docx"',
    },
  })
}
