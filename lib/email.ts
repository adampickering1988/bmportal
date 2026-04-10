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
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 0;">
      <div style="background:#0D1B2A;border-radius:12px;padding:32px;color:#fff;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.2em;color:#C0392B;text-transform:uppercase;margin-bottom:8px;">Ideal Direct</div>
        <h1 style="margin:0 0 4px;font-size:22px;font-weight:900;">Brand Manager Assessment</h1>
        <p style="color:#6B7A8D;font-size:14px;margin:0;">Amazon Account Manager Recruitment</p>
      </div>

      <div style="padding:24px 0;">
        <p style="font-size:15px;color:#2C3E50;line-height:1.6;margin:0 0 16px;">
          Hi ${name},
        </p>
        <p style="font-size:15px;color:#2C3E50;line-height:1.6;margin:0 0 24px;">
          You have been invited to complete the Ideal Direct Brand Manager assessment. Use the access code below to log in and begin.
        </p>

        <div style="background:#F4F6F8;border:2px solid #E8EBF0;border-radius:10px;padding:20px;text-align:center;margin:0 0 24px;">
          <div style="font-size:12px;color:#6B7A8D;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">Your Access Code</div>
          <div style="font-size:32px;font-weight:900;font-family:monospace;letter-spacing:0.3em;color:#0D1B2A;">${code}</div>
        </div>

        <a href="${PORTAL_URL}" style="display:block;background:#C0392B;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">
          Go to Assessment Portal &rarr;
        </a>

        <div style="margin-top:24px;padding:16px;background:#FEF9E7;border:1px solid #F39C12;border-radius:8px;">
          <p style="font-size:13px;color:#7D6608;margin:0;line-height:1.5;">
            <strong>Important:</strong> You have 90 minutes to complete the assessment once you begin. Make sure you have uninterrupted time before starting.
          </p>
        </div>
      </div>

      <div style="border-top:1px solid #E8EBF0;padding-top:16px;font-size:12px;color:#6B7A8D;">
        This email was sent by the Ideal Direct recruitment team. If you did not expect this, please disregard it.
      </div>
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
            subject: 'Your Assessment Access Code — Ideal Direct',
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
