import { prisma } from "../config/prisma.js";
import { supportedSubjects } from "../lib/constants.js";
import { handleFunctionError, ValidationError } from "../lib/errors.js";

function assertSupportedSubject(subject: string) {
  if (!supportedSubjects.includes(subject)) {
    throw new ValidationError(
      `Subject "${subject}" is not supported. Supported subjects are: ${supportedSubjects.join(", ")}`,
    );
  }
}

// Maps a Question row onto the shape the quiz API already returns to clients.
export function toDbQuestion(q: {
  id: string;
  question: string;
  options: unknown;
  section: string;
  image: string | null;
  answer: string;
  solution: string | null;
  examType: string | null;
  examYear: string | null;
  questionNub: number | null;
  hasPassage: boolean;
  category: string | null;
  topic: string | null;
}): DbQuestionType {
  return {
    id: q.id,
    question: q.question,
    option: q.options as Option,
    section: q.section,
    image: q.image,
    answer: q.answer,
    solution: q.solution,
    examtype: q.examType,
    examyear: q.examYear,
    questionNub: q.questionNub,
    hasPassage: q.hasPassage ? 1 : 0,
    category: q.category ?? q.topic,
  };
}

export class DbQuestionService {
  async getQuestionsBySubject(subject: string, limit: number = 10) {
    try {
      const name = subject.toLowerCase();
      assertSupportedSubject(name);

      const where = { subject: name };
      const total = await prisma.question.count({ where });
      // Random window so repeat sessions do not always get the same questions.
      const skip =
        total > limit ? Math.floor(Math.random() * (total - limit)) : 0;
      const questions = await prisma.question.findMany({
        where,
        skip,
        take: limit,
      });

      return { subject: name, status: 200, data: questions.map(toDbQuestion) };
    } catch (error) {
      handleFunctionError(error, "fetching questions from database");
    }
  }

  async getSubjectCount(subject: string) {
    try {
      const name = subject.toLowerCase();
      assertSupportedSubject(name);

      const questions = await prisma.question.count({
        where: { subject: name },
      });
      return { questions, subject: name };
    } catch (error) {
      handleFunctionError(error, "counting questions in database");
    }
  }
}
