import { Router } from "express";
import { resend } from "../config/resend.js";
import { forwardContactEmail } from "../lib/resend.js";

export const webhookRoutes: Router = Router();

webhookRoutes.post("/resend", async (req, res) => {
  try {
    const event = req.body;
    res.status(200).json({ received: true });
    const email = event.data;
    const { data } = await resend.emails.receiving.get(email.email_id);
    await forwardContactEmail(
      email.from,
      data?.subject || "",
      data?.text || "",
    );
  } catch (error) {
    throw error;
  }
});
