import { prisma } from "../config/prisma.js";
import { subjectImages } from "../lib/constants.js";
import { handleFunctionError, ValidationError } from "../lib/errors.js";

function formatSubjectName(slug: string) {
  return slug.replace(/\b\w/g, (char) => char.toUpperCase());
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
  async getSubjects() {
    try {
      const rows = await prisma.question.groupBy({
        by: ["subject"],
        _count: { _all: true },
      });

      return rows
        .map(({ subject, _count }) => ({
          name: formatSubjectName(subject),
          apiKey: subject,
          questions: _count._all.toLocaleString("en-US"),
          image: subjectImages[subject] ?? "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      handleFunctionError(error, "fetching subjects from database");
    }
  }

  async getQuestionsBySubject(subject: string, limit: number = 10) {
    try {
      const name = subject.toLowerCase();

      const where = { subject: name };
      const total = await prisma.question.count({ where });
      if (total === 0) {
        throw new ValidationError(
          `Subject "${subject}" has no questions available`,
        );
      }

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
      const questions = await prisma.question.count({
        where: { subject: name },
      });
      return { questions, subject: name };
    } catch (error) {
      handleFunctionError(error, "counting questions in database");
    }
  }
}
