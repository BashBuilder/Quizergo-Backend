import z from "zod";

export const subjectQuerySchema = z.object({
  name: z.string("Name must be type string").optional(),
  question: z.coerce.number("Question must be type number").optional(),
});
// .strict({
//   message: "Query params can include only name and question",
// });
