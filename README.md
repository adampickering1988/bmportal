# Brand X — Assessment Portal

A Next.js recruitment portal for the Brand X Amazon Account Manager assessment.

## Quick Deploy to Vercel

1. Push this repo to GitHub
2. Import to [vercel.com](https://vercel.com) — it will auto-detect Next.js
3. Add a **Vercel KV** store from the Storage tab (free tier is fine)
4. Add a **Vercel Blob** store from the Storage tab (for file uploads)
5. Set these environment variables in Vercel > Settings > Environment Variables:

| Variable | Value |
|---|---|
| `JWT_SECRET` | Any long random string (32+ chars) |
| `RECRUITER_PASSWORD` | Your chosen recruiter password |

KV and Blob tokens are added automatically when you connect the stores.

6. Deploy — done.

## Local Development

```bash
npm install
# Add real values to .env.local (see .env.local template)
npm run dev
```

Without KV configured, the app uses an in-memory store (resets on restart — fine for local testing).

## Default Demo Candidates

Two demo candidates are seeded automatically on first login:
- Code: `DEMO01` — Alex Johnson
- Code: `DEMO02` — Sam Williams

## Recruiter Portal

Visit `/recruiter` and log in with your `RECRUITER_PASSWORD`.

From the recruiter portal you can:
- View all candidates and their status (Not Started / In Progress / Submitted)
- Read or download every submission
- Download the Answer Key and Listing Issues Reference documents
- Add new candidates and generate access codes

## File Structure

```
public/assets/
  performance-data.xlsx      ← 30-day ads data (candidate download)
  product-listings.html      ← Mock Amazon listings (candidate iframe)
  answer-key.docx            ← Marking guide (recruiter only)
  listing-issues.docx        ← Listing issues reference (recruiter only)
```

To update assessment files, replace the files in `public/assets/` and redeploy.
