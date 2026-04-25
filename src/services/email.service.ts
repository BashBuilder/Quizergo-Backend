import Logger from "../../core/Logger.js";
import eventEmitter from "../config/events.js";
import { sendWelcomeEmail } from "../lib/resend.js";

eventEmitter.on("user.verified", async (data) => {
  try {
    Logger.info("Verified event listend to", data);
    await sendWelcomeEmail(data.email, data.firstName);
  } catch (error) {
    Logger.error("Failed to send welcome email", error);
  }
});
