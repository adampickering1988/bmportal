// Email sending via Microsoft Graph API (cara@idealdirect.co.uk)

const PORTAL_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

const FROM_USER = process.env.AZURE_MAIL_FROM || 'cara@idealdirect.co.uk'

async function getAccessToken(): Promise<string | null> {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    console.warn('[email] Azure credentials not set — skipping email')
    return null
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    console.error('[email] Failed to get Azure access token:', response.status, text)
    return null
  }

  const data = await response.json()
  return data.access_token as string
}

function buildHtml(name: string, code: string): string {
  const firstName = name.split(' ')[0] || name
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#2C3E50;">
      <div style="background:#0D1B2A;border-radius:12px;padding:28px 32px;color:#fff;margin-bottom:24px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.2em;color:#C0392B;text-transform:uppercase;margin-bottom:8px;">Ideal Direct</div>
        <h1 style="margin:0 0 4px;font-size:22px;font-weight:900;">Brand Manager Assessment</h1>
        <p style="color:#9BAAB8;font-size:14px;margin:0;">Next steps in your application</p>
      </div>

      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hi ${firstName},</p>

      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        Thank you for applying for the Brand Manager role at Ideal Direct. The next stage of our process is a 90-minute online assessment that mirrors the kind of work you'd be doing day-to-day if you joined the team.
      </p>

      <h2 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#0D1B2A;margin:24px 0 8px;">The brief</h2>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        You'll take on the role of Brand Manager for a small fictional health supplement brand selling on Amazon UK. Inside the portal you'll find a 30-day performance dashboard, a full advertising campaign report, a search term report, and three complete mock product listings.
      </p>

      <h2 style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#0D1B2A;margin:24px 0 8px;">Your task</h2>
      <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">Produce a written analysis covering:</p>
      <ul style="font-size:15px;line-height:1.6;margin:0 0 16px;padding-left:20px;">
        <li>Overall account health and the strongest/weakest SKUs</li>
        <li>A detailed advertising audit (wasted spend, opportunities, cannibalisation, recommendations)</li>
        <li>A root-cause diagnosis of one underperforming SKU</li>
        <li>A listing-quality review of all three products</li>
      </ul>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
        We're looking for clear, evidence-led thinking — cite the numbers and campaign IDs throughout. There are no trick questions and no prior supplement-industry knowledge is required.
      </p>

      <div style="background:#FEF9E7;border:2px solid #F39C12;border-radius:10px;padding:20px;margin:0 0 24px;">
        <div style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#7D6608;margin-bottom:12px;">⚠ Please read carefully before you log in</div>
        <ul style="font-size:14px;line-height:1.65;margin:0;padding-left:18px;color:#5D4E08;">
          <li style="margin-bottom:10px;"><strong>You have 90 minutes. The timer starts the moment you enter your access code — not when you click "submit".</strong></li>
          <li style="margin-bottom:10px;"><strong>The timer does not pause or reset for any reason.</strong> Logging out, closing your browser, losing your connection or stepping away will not stop the clock.</li>
          <li style="margin-bottom:10px;"><strong>When the 90 minutes are up, whatever you have already submitted will be treated as your final answer.</strong> Anything still in draft will be auto-submitted in its current state — so submit early and update if you have time, rather than leaving everything to the end.</li>
          <li>Pick a quiet 90-minute window with no interruptions. Have water, a notepad, and Excel or Google Sheets ready. Treat it like a written exam.</li>
        </ul>
      </div>

      <div style="background:#F4F6F8;border:2px solid #E8EBF0;border-radius:10px;padding:20px;text-align:center;margin:0 0 16px;">
        <div style="font-size:12px;color:#6B7A8D;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">Your Access Code</div>
        <div style="font-size:32px;font-weight:900;font-family:monospace;letter-spacing:0.3em;color:#0D1B2A;">${code}</div>
      </div>

      <a href="${PORTAL_URL}" style="display:block;background:#C0392B;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:24px;">
        Begin Assessment Now &rarr;
      </a>

      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#5A6B7D;">
        If anything is unclear before you start, reply to this email and I'll come back to you within working hours. Once you've started, I won't be able to extend the timer.
      </p>

      <p style="font-size:14px;line-height:1.6;margin:0 0 4px;">Good luck — we're looking forward to seeing how you think.</p>

      <p style="font-size:14px;line-height:1.6;margin:24px 0 0;">
        Cara<br/>
        <span style="color:#6B7A8D;">Ideal Direct Recruitment</span><br/>
        <a href="mailto:cara@idealdirect.co.uk" style="color:#C0392B;text-decoration:none;">cara@idealdirect.co.uk</a>
      </p>
    </div>
  `
}

export async function sendAccessCodeEmail(
  to: string,
  name: string,
  code: string,
): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false

  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(FROM_USER)}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: 'Your Brand Manager Assessment — Next Steps',
            body: {
              contentType: 'HTML',
              content: buildHtml(name, code),
            },
            toRecipients: [{ emailAddress: { address: to } }],
          },
          saveToSentItems: true,
        }),
      },
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('[email] Graph sendMail failed:', response.status, text)
      return false
    }

    return true
  } catch (err) {
    console.error('[email] Failed to send access code email:', err)
    return false
  }
}
