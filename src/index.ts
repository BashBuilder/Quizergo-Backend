import "dotenv/config.js";
import Logger from "./core/Logger.js";
import app, { initializeApp, shutdown } from "./app.js";

const PORT = process.env.PORT || 4000;
const startServer = async () => {
  try {
    await initializeApp();
    app.listen(PORT, () => {
      Logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    Logger.error("Error starting server", error);
    process.exit(1);
  }
};

startServer();

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});
