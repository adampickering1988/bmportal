import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const PORTAL_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

export async function sendAccessCodeEmail(
  to: string,
  name: string,
  code: string,
): Promise<boolean> {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping email')
    return false
  }

  try {
    await resend.emails.send({
      from: `Ideal Direct Recruitment <${FROM_EMAIL}>`,
      to,
      subject: 'Your Assessment Access Code — Ideal Direct',
      html: `
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
      `,
    })
    return true
  } catch (err) {
    console.error('[email] Failed to send access code email:', err)
    return false
  }
}
