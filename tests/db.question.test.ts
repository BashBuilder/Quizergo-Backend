import { describe, expect, it } from "vitest";
import {
  DbQuestionService,
  toDbQuestion,
} from "../src/services/db.question.service.js";
import { ValidationError } from "../src/lib/errors.js";

const row = {
  id: "uuid-1",
  mockId: null,
  subject: "mathematics",
  topic: "Algebra",
  question: "1 + 1 = ?",
  answer: "b",
  section: "",
  questionNub: 1,
  hasPassage: false,
  category: null,
  options: { a: "1", b: "2", c: "3", d: "4" },
  solution: "one plus one is two",
  image: null,
  examType: "JAMB",
  examYear: "2026",
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("DbQuestionService", () => {
  it("maps database rows onto the question API shape", () => {
    expect(toDbQuestion(row)).toEqual({
      id: "uuid-1",
      question: "1 + 1 = ?",
      option: { a: "1", b: "2", c: "3", d: "4" },
      section: "",
      image: null,
      answer: "b",
      solution: "one plus one is two",
      examtype: "JAMB",
      examyear: "2026",
      questionNub: 1,
      hasPassage: 0,
      category: "Algebra",
    });
  });

  it("rejects subjects with no questions in the database", async () => {
    await expect(
      new DbQuestionService().getQuestionsBySubject("astrology"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
