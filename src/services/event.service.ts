import eventEmitter from "../config/events.js";
import Logger from "../core/Logger.js";
import { sendWelcomeEmail } from "../lib/resend.js";

eventEmitter.on("aloc.question.fetched", async (questions) => {
  Logger.info(`Fetched ${questions.length} questions from ALOC`, questions);
});

// Email Events
eventEmitter.on("user.verified", async (data) => {
  try {
    Logger.info("Verified event listend to", data);
    await sendWelcomeEmail(data.email, data.firstName);
  } catch (error) {
    Logger.error("Failed to send welcome email", error);
  }
});
