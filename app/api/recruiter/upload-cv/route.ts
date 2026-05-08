import { NextRequest, NextResponse } from 'next/server'
import { requireRecruiterSession } from '@/lib/auth'
import { getCandidate, updateCandidate } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await requireRecruiterSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const formData = await req.formData()
  const code = formData.get('code') as string
  const file = formData.get('file') as File | null

  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })
  if (!file || file.size === 0) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const candidate = await getCandidate(code)
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Blob storage not configured' }, { status: 500 })
  }

  try {
    const { put } = await import('@vercel/blob')
    const blobName = `cvs/${code.toUpperCase()}/${Date.now()}-${file.name}`
    const blob = await put(blobName, file, { access: 'private', addRandomSuffix: false })

    await updateCandidate(code, {
      cvUrl: blob.url,
      cvFileName: file.name,
      cvUploadedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, fileName: file.name })
  } catch (err: any) {
    console.error('[upload-cv] Failed:', err)
    return NextResponse.json({ error: err?.message || 'Upload failed' }, { status: 500 })
  }
}
