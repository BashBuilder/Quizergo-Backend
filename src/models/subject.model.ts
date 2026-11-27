import z from "zod";

export const subjectQuerySchema = z.object({
  name: z.string("Name must be type string").optional(),
  question: z.coerce.number("Question must be type number").optional(),
});

export const questionQuerySchema = z.object({
  duration: z.coerce.number("Duration must be type number").optional(),
  subject: z.union([
    z.string("Subject must be type string"),
    z.array(z.string("Subject must be type string")),
  ]),
  limit: z.coerce.number("Question must be type number").optional(),
});
