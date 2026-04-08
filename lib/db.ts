// Simple KV wrapper — falls back to in-memory store for local dev without KV
// In production, set KV_REST_API_URL + KV_REST_API_TOKEN in Vercel dashboard

let kvClient: any = null

async function getKV() {
  if (kvClient) return kvClient
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { createClient } = await import('@vercel/kv')
    kvClient = createClient({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  } else {
    // In-memory fallback for local dev
    const store = new Map<string, string>()
    kvClient = {
      get: async (k: string) => {
        const v = store.get(k)
        return v ? JSON.parse(v) : null
      },
      set: async (k: string, v: any) => { store.set(k, JSON.stringify(v)) },
      keys: async (pattern: string) => {
        const prefix = pattern.replace('*', '')
        return [...store.keys()].filter(k => k.startsWith(prefix))
      },
    }
  }
  return kvClient
}

export interface CandidateRecord {
  code: string
  name: string
  email: string
  createdAt: string
  startedAt?: string
  submittedAt?: string
}

export interface Submission {
  id: string
  candidateCode: string
  candidateName: string
  candidateEmail: string
  task: 'ads' | 'listings'
  type: 'text' | 'file'
  content?: string        // for text responses
  fileUrl?: string        // for file uploads (Vercel Blob URL)
  fileName?: string
  submittedAt: string
}

// Candidate management
export async function getCandidate(code: string): Promise<CandidateRecord | null> {
  const kv = await getKV()
  return kv.get(`candidate:${code.toUpperCase()}`)
}

export async function createCandidate(data: Omit<CandidateRecord, 'createdAt'>): Promise<void> {
  const kv = await getKV()
  const record: CandidateRecord = { ...data, createdAt: new Date().toISOString() }
  await kv.set(`candidate:${data.code.toUpperCase()}`, record)
}

export async function updateCandidate(code: string, updates: Partial<CandidateRecord>): Promise<void> {
  const kv = await getKV()
  const existing = await getCandidate(code)
  if (existing) {
    await kv.set(`candidate:${code.toUpperCase()}`, { ...existing, ...updates })
  }
}

export async function listCandidates(): Promise<CandidateRecord[]> {
  const kv = await getKV()
  const keys: string[] = await kv.keys('candidate:*')
  const candidates = await Promise.all(keys.map(k => kv.get(k)))
  return candidates.filter(Boolean).sort((a: CandidateRecord, b: CandidateRecord) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

// Submissions
export async function saveSubmission(sub: Omit<Submission, 'submittedAt'>): Promise<void> {
  const kv = await getKV()
  const record: Submission = { ...sub, submittedAt: new Date().toISOString() }
  await kv.set(`submission:${sub.id}`, record)
}

export async function getSubmissionsForCandidate(candidateCode: string): Promise<Submission[]> {
  const kv = await getKV()
  const keys: string[] = await kv.keys('submission:*')
  const all = await Promise.all(keys.map(k => kv.get(k)))
  return all
    .filter((s: Submission) => s?.candidateCode === candidateCode.toUpperCase())
    .sort((a: Submission, b: Submission) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )
}

export async function listAllSubmissions(): Promise<Submission[]> {
  const kv = await getKV()
  const keys: string[] = await kv.keys('submission:*')
  const all = await Promise.all(keys.map(k => kv.get(k)))
  return all
    .filter(Boolean)
    .sort((a: Submission, b: Submission) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )
}

// Seed default candidates for demo
export async function seedDemoCandidates() {
  const demos = [
    { code: 'DEMO01', name: 'Alex Johnson', email: 'alex@example.com' },
    { code: 'DEMO02', name: 'Sam Williams', email: 'sam@example.com' },
  ]
  for (const d of demos) {
    const existing = await getCandidate(d.code)
    if (!existing) await createCandidate(d)
  }
}
