import eventEmitter from "../config/events.js";
import { sendWelcomeEmail } from "../lib/resend.js";

eventEmitter.on("user.verified", async (data) => {
  try {
    await sendWelcomeEmail(data.email, data.firstName);
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
});
