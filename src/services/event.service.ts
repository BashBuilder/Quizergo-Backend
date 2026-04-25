import eventEmitter from "../config/events.js";

eventEmitter.on("aloc.question.fetched", async (questions) => {
  console.log(`Fetched ${questions.length} questions from ALOC`, questions);
  // You can add additional logic here, such as logging to a database or analytics service
});
