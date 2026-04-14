import { NextRequest, NextResponse } from 'next/server'
import { requireRecruiterSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await requireRecruiterSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const blobUrl = req.nextUrl.searchParams.get('url')
  if (!blobUrl) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })

  // Only allow fetching from our own Vercel Blob store
  if (!blobUrl.includes('.blob.vercel-storage.com/')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const response = await fetch(blobUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const blob = await response.blob()
    const filename = blobUrl.split('/').pop() || 'download'

    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}
