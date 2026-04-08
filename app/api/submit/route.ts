import { NextRequest, NextResponse } from 'next/server'
import { requireCandidateSession } from '@/lib/auth'
import { saveSubmission, updateCandidate } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function POST(req: NextRequest) {
  const session = await requireCandidateSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const formData = await req.formData()
  const task = formData.get('task') as 'ads' | 'listings'
  const textContent = formData.get('text') as string | null
  const file = formData.get('file') as File | null

  if (!task) return NextResponse.json({ error: 'Task required' }, { status: 400 })
  if (!textContent && !file) return NextResponse.json({ error: 'No content provided' }, { status: 400 })

  let fileUrl: string | undefined
  let fileName: string | undefined

  if (file && file.size > 0) {
    // Upload to Vercel Blob if configured, otherwise store filename only
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob')
      const blobName = `submissions/${session.code}/${task}-${Date.now()}-${file.name}`
      const blob = await put(blobName, file, { access: 'private', addRandomSuffix: false })
      fileUrl = blob.url
    }
    fileName = file.name
  }

  const candidate = { code: session.code, name: session.name } as any
  // Get email from DB
  const { getCandidate } = await import('@/lib/db')
  const record = await getCandidate(session.code)

  await saveSubmission({
    id: uuid(),
    candidateCode: session.code,
    candidateName: session.name,
    candidateEmail: record?.email || '',
    task,
    type: file && file.size > 0 ? 'file' : 'text',
    content: textContent || undefined,
    fileUrl,
    fileName,
  })

  // Mark candidate as submitted if both tasks done
  await updateCandidate(session.code, { submittedAt: new Date().toISOString() })

  return NextResponse.json({ ok: true })
}
