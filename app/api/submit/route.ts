import { NextRequest, NextResponse } from 'next/server'
import { requireCandidateSession } from '@/lib/auth'
import { enforceExpiry, getCandidate, getTimerState, saveSubmission, updateCandidate } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function POST(req: NextRequest) {
  const session = await requireCandidateSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Enforce timer first — if the candidate's 90 mins are up, finalise drafts
  // and reject any new submissions.
  await enforceExpiry(session.code)
  const candidate = await getCandidate(session.code)
  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const timer = getTimerState(candidate)
  if (timer.expired) {
    return NextResponse.json({ error: 'Your 90 minutes are up. Submissions are now closed.', expired: true }, { status: 403 })
  }

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

  await saveSubmission({
    id: uuid(),
    candidateCode: session.code,
    candidateName: session.name,
    candidateEmail: candidate.email,
    task,
    type: file && file.size > 0 ? 'file' : 'text',
    content: textContent || undefined,
    fileUrl,
    fileName,
  })

  // Clear the matching draft now that it's been formally submitted, and
  // record submittedAt if not already set.
  const draftClear = task === 'ads' ? { draftAds: '' } : { draftListings: '' }
  await updateCandidate(session.code, {
    ...draftClear,
    submittedAt: candidate.submittedAt || new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
