import z from "zod";

export const createSessionModel = z.object({
  subjects: z
    .array(z.string(), "Subjects are required")
    .min(1, "At least one subject is required"),
  questionCount: z.coerce
    .number("Question count is required")
    .min(1, "At least one question is required"),
  duration: z.coerce
    .number("Duration is required")
    .min(1, "Duration is required"),
});

export const answersModel = z.object({
  answers: z
    .array(
      z.object(
        {
          subject: z.string("Subject is required"),
          answers: z.record(
            z.string("Question id is required"),
            z.string("Question answer is required"),
          ),
        },
        "Answers object is required",
      ),
      "Answers for each subject are required as an array",
    )
    .min(1, "At least one answer is required"),
});

export const sessionValidation = z.object({
  sessionId: z.string("Session id is required"),
});
