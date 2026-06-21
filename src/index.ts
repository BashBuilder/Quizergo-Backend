import "dotenv/config.js";
import Logger from "../core/Logger.js";
import app, { shutdown } from "./app.js";

const PORT = process.env.PORT || 4000;
const startServer = async () => {
  try {
    app.listen(PORT, () => {
      Logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    Logger.error("Error starting server", error);
  }
};
startServer();
process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});
