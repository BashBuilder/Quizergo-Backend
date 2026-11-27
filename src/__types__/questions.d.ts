declare global {
  interface Option {
    a: string;
    b: string;
    c: string;
    d: string;
    e?: string;
  }

  interface DbQuestionType {
    id: string;
    question: string;
    option: Option;
    section: string;
    image: string | null;
    answer: string;
    solution: string | null;
    examtype: string | null;
    examyear: string | null;
    questionNub: number | null;
    hasPassage: number;
    category: string | null;
  }

  interface AnswersType {
    subject: string;
    answers: Record<string, string>;
  }

  interface QuizQuestionsType {
    subject: string;
    questions: DbQuestionType[];
  }

  interface BreakdownQuestion {
    questionId: string;
    question: string;
    option: Option;
    image: string | null;
    userAnswer: string | null;
    correctAnswer: string;
    solution: string | null;
    status: "correct" | "incorrect" | "skipped";
  }
  interface BreakdownGroup {
    subject: string;
    questions: BreakdownQuestion[];
  }

  interface QuizResultReturnType {
    sessionId: string;
    score: number;
    total: number;
    correct: { subject: string; count: number }[];
    incorrect: { subject: string; count: number }[];
    skipped: { subject: string; count: number }[];
    timeTaken: number;
    breakdown: BreakdownGroup[];
    submittedAt: number;
  }
}

export {};
