declare global {
  interface Option {
    a: string;
    b: string;
    c: string;
    d: string;
    e?: string;
  }

  interface AlocQuestionType {
    id: number;
    question: string;
    option: Option;
    section: string;
    image: string;
    answer: string;
    solution: string;
    examtype: string;
    examyear: string;
    questionNub: number;
    hasPassage: number;
    category: string;
  }

  interface AnswersType {
    subject: string;
    answers: Record<number, string>;
  }

  interface AnswerType {
    answers: AnswersType[] | null;
  }

  interface QuizQuestionsType {
    subject: string;
    questions: AlocQuestionType[];
  }

  interface BreakdownQuestion {
    questionId: number; // mockId
    question: string;
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

// types/quiz.d.ts
declare global {
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

  interface AnswerType {
    answers: AnswersType[] | null;
  }
}

export {};
