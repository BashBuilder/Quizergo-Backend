import Logger from "../core/Logger.js";
import { resend, RESEND_CONTACT_EMAIL } from "../config/resend.js";

// const LOGO_URL = "https://quizergo.online/assets/icon.svg";
const LOGO_URL = "assets/icon.svg";
const APP_URL = "https://quizergo.online";
const SUPPORT_EMAIL = "contact@quizergo.online";

// Design tokens
const COLORS = {
  brand: {
    primary: "#2563eb", // Royal blue - trust, education
    accent: "#f97316", // Orange - energy, action
    dark: "#1e293b", // Slate 800 - professional, mature
    muted: "#64748b", // Slate 500 - subtle, readable
    light: "#f1f5f9", // Slate 100 - soft contrast
  },
  backgrounds: {
    primary: "#ffffff", // Clean white
    secondary: "#f8fafc", // Slate 50 - subtle
    accent: "#eff6ff", // Blue 50 - soft brand tint
  },
  borders: "#e2e8f0", // Slate 200
};

/**
 * Modern email layout with sophisticated design
 */
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
<title>Quizergo</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
</style>
</head>
<body style="margin:0; padding:0; background-color:${COLORS.backgrounds.primary}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:${COLORS.brand.dark}; line-height:1.5;">
  <!-- Preheader: shows as the preview snippet in the inbox list, hidden in the body -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all; font-size:1px; color:#ffffff; line-height:1px;">
    ${previewText}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.backgrounds.secondary}; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:${COLORS.backgrounds.primary}; border-radius:12px; overflow:hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03);">

          <!-- Header -->
          <tr>
            <td style="padding:40px 32px 28px; text-align:center; background-color:${COLORS.backgrounds.accent};">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="width:64px; height:64px; border-radius:50%; background-color:${COLORS.backgrounds.primary}; display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                      <img src="${LOGO_URL}" width="36" height="36" alt="Quizergo" style="display:block; border:0;" />
                    </div>
                  </td>
                </tr>
              </table>
              <div style="font-size:28px; font-weight:700; color:${COLORS.brand.dark}; letter-spacing:-0.5px; margin:0;">
                Quizergo
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 32px; border-top:1px solid ${COLORS.borders}; background-color:${COLORS.backgrounds.secondary};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 8px; font-size:14px; color:${COLORS.brand.muted}; line-height:1.4;">
                      Questions? Reach us at 
                      <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLORS.brand.primary}; text-decoration:none; font-weight:500;">${SUPPORT_EMAIL}</a>
                    </p>
                    <p style="margin:0; font-size:13px; color:${COLORS.brand.muted}; opacity:0.8;">
                      &copy; ${new Date().getFullYear()} Quizergo. All rights reserved.
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
    <div style="margin-bottom:24px;">
      <h1 style="margin:0 0 12px; font-size:24px; font-weight:700; color:${COLORS.brand.dark}; letter-spacing:-0.5px;">
        Welcome, ${name}!
      </h1>
      <p style="margin:0 0 16px; font-size:15px; color:${COLORS.brand.muted};">
        You're all set. Quizergo gives you authentic past questions, timed mock exams, and instant feedback on every attempt — everything you need to walk into your next exam prepared.
      </p>
      <p style="margin:0; font-size:14px; color:${COLORS.brand.muted};">
        Best,<br />
        <strong style="color:${COLORS.brand.dark};">The Quizergo Team</strong>
      </p>
    </div>
    
    <a href="${APP_URL}" style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; background-color:${COLORS.brand.primary}; border-radius:8px; transition: background-color 0.2s; font-family: 'Inter', sans-serif;">
      Start practicing
    </a>
  `;

  try {
    await resend.emails.send({
      from: "Quizergo <contact@quizergo.online>",
      to: email,
      subject: "Welcome to Quizergo!",
      html: emailLayout({
        previewText: `Welcome to Quizergo, ${name} — let's get you exam-ready.`,
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
    <div style="margin-bottom:24px;">
      <h1 style="margin:0 0 12px; font-size:24px; font-weight:700; color:${COLORS.brand.dark}; letter-spacing:-0.5px;">
        Verify your email
      </h1>
      <p style="margin:0 0 24px; font-size:15px; color:${COLORS.brand.muted};">
        Enter this code to confirm it's really you. It expires in 10 minutes.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td align="center">
            <div style="background-color:#ffffff; border:2px solid ${COLORS.borders}; border-radius:12px; padding:28px; text-align:center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <span style="font-size:32px; font-weight:700; letter-spacing:8px; color:${COLORS.brand.dark}; font-family: 'Inter', sans-serif; font-variant-numeric: tabular-nums;">
                ${otp}
              </span>
            </div>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 16px; font-size:14px; color:${COLORS.brand.muted}; text-align:center;">
        Didn't request this code? You can safely ignore this email.
      </p>

      <p style="margin:0; font-size:14px; color:${COLORS.brand.muted};">
        Best,<br />
        <strong style="color:${COLORS.brand.dark};">The Quizergo Team</strong>
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Quizergo <contact@quizergo.online>",
      to: email,
      subject: "Your Quizergo verification code",
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

export const forwardContactEmail = async (
  email: string,
  subject: string,
  message: string,
) => {
  const bodyHtml = `
    <div style="margin-bottom:24px;">
      <h1 style="margin:0 0 12px; font-size:20px; font-weight:600; color:${COLORS.brand.dark}; letter-spacing:-0.3px;">
        New contact message from Quizergo user
      </h1>
      
      <div style="background-color:${COLORS.backgrounds.secondary}; border-left:4px solid ${COLORS.brand.primary}; border-radius:0 8px 8px 0; padding:16px 20px; margin-bottom:24px;">
        <p style="margin:0 0 8px; font-size:14px; color:${COLORS.brand.muted}; font-weight:500;">
          <span style="color:${COLORS.brand.dark};">${email}</span>
        </p>
        <p style="margin:0; font-size:15px; color:${COLORS.brand.dark}; white-space:pre-wrap;">
          ${message}
        </p>
      </div>

      <p style="margin:0; font-size:14px; color:${COLORS.brand.muted};">
        Best,<br />
        <strong style="color:${COLORS.brand.dark};">The Quizergo Team</strong>
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Quizergo Contact <contact@quizergo.online>",
      to: RESEND_CONTACT_EMAIL,
      subject: `[Quizergo] ${subject}`,
      html: emailLayout({
        previewText: `New contact message from ${email}`,
        bodyHtml,
      }),
    });
  } catch (error) {
    Logger.error("Failed to send contact email", error);
    throw new Error("Failed to send contact email");
  }
};
