import Logger from "../../core/Logger.js";
import { resend } from "../config/resend.js";

const LOGO_URL = "https://i.postimg.cc/0jXWMx1m/logo.png";
const APP_URL = "https://quizergo.online";
const SUPPORT_EMAIL = "contact@quizergo.online";

const BRAND_ORANGE = "#f97316";
const BRAND_DARK = "#1c1917";
const BRAND_MUTED = "#78716c";

function emailLayout({
  previewText,
  bodyHtml,
}: {
  previewText: string;
  bodyHtml: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>QuizerGo</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f1ee; font-family: Helvetica, Arial, sans-serif;">
  <!-- Preheader: shows as the preview snippet in the inbox list, hidden in the body -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
    ${previewText}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ee; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow: 0 2px 12px rgba(28,25,23,0.06);">

          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#fff3e6; padding: 40px 24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:64px; height:64px; border-radius:50%; background-color:#ffffff; box-shadow: 0 4px 14px rgba(249,115,22,0.25);" align="center" valign="middle">
                    <img src="${LOGO_URL}" width="40" height="40" alt="QuizerGo" style="display:block; border:0;" />
                  </td>
                </tr>
              </table>
              <div style="margin-top:16px; font-size:22px; font-weight:700; color:${BRAND_DARK}; letter-spacing:-0.5px;">
                Quizer<span style="color:${BRAND_ORANGE};">Go</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 32px; border-top:1px solid #f1ede9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <img src="${LOGO_URL}" width="20" height="20" alt="" style="display:block; margin: 0 auto 10px; opacity:0.5;" />
                    <p style="margin:0; font-size:12px; color:${BRAND_MUTED}; line-height:18px;">
                      Questions? Reach us at
                      <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_ORANGE}; text-decoration:none;">${SUPPORT_EMAIL}</a>
                    </p>
                    <p style="margin:6px 0 0; font-size:12px; color:#a8a29e;">
                      &copy; ${new Date().getFullYear()} QuizerGo. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// --- Welcome email ---------------------------------------------------------

export const sendWelcomeEmail = async (email: string, name: string) => {
  const bodyHtml = `
    <h1 style="margin:0 0 12px; font-size:24px; font-weight:700; color:${BRAND_DARK};">
      Welcome, ${name}! 🎉
    </h1>
    <p style="margin:0 0 24px; font-size:15px; line-height:24px; color:${BRAND_MUTED};">
      You're all set. QuizerGo gives you real past questions, timed mock exams, and instant
      feedback on every attempt -- everything you need to walk into your next exam prepared.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 28px;">
      <tr>
        <td style="border-radius:12px; background-color:${BRAND_ORANGE};">
          <a href="${APP_URL}" style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">
            Start practicing &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0; font-size:14px; line-height:22px; color:${BRAND_MUTED};">
      Best,<br />
      <strong style="color:${BRAND_DARK};">The QuizerGo Team</strong>
    </p>
  `;

  try {
    await resend.emails.send({
      from: "QuizerGo <anthony@quizergo.online>",
      to: email,
      subject: "Welcome to QuizerGo!",
      html: emailLayout({
        previewText: `Welcome to QuizerGo, ${name} -- let's get you exam-ready.`,
        bodyHtml,
      }),
    });
  } catch (error) {
    Logger.error("Failed to send welcome email", error);
    throw new Error("Failed to send welcome email");
  }
};

// --- OTP email ---------------------------------------------------------

export const sendOTPEmail = async (email: string, otp: string) => {
  const bodyHtml = `
    <h1 style="margin:0 0 12px; font-size:24px; font-weight:700; color:${BRAND_DARK};">
      Verify your email
    </h1>
    <p style="margin:0 0 24px; font-size:15px; line-height:24px; color:${BRAND_MUTED};">
      Enter this code in the app to confirm it's really you. It expires in 10 minutes.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td align="center" style="background-color:#fff7ed; border:1.5px dashed ${BRAND_ORANGE}; border-radius:16px; padding:24px;">
          <span style="font-size:34px; font-weight:700; letter-spacing:10px; color:${BRAND_DARK}; font-family: 'Courier New', Courier, monospace;">
            ${otp}
          </span>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px; font-size:13px; line-height:20px; color:#a8a29e;">
      Didn't request this code? You can safely ignore this email.
    </p>

    <p style="margin:0; font-size:14px; line-height:22px; color:${BRAND_MUTED};">
      Best,<br />
      <strong style="color:${BRAND_DARK};">The QuizerGo Team</strong>
    </p>
  `;

  try {
    await resend.emails.send({
      from: "QuizerGo <anthony@quizergo.online>",
      to: email,
      subject: "Your QuizerGo verification code",
      html: emailLayout({
        previewText: `Your verification code is ${otp}`,
        bodyHtml,
      }),
    });
  } catch (error) {
    Logger.error("Failed to send OTP email", error);
    throw new Error("Failed to send OTP email");
  }
};
