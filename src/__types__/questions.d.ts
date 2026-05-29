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

  interface QuizQuestionsType {
    subject: string;
    questions: AlocQuestionType[];
  }

  interface QuizResultReturnType {
    sessionId: string;
    score: number;
    correct: {
      subject: string;
      count: number;
    }[];
    incorrect: {
      subject: string;
      count: number;
    }[];
    skipped: {
      subject: string;
      count: number;
    }[];
    total: number;
    timeTaken: number;
    breakdown: {
      subject: string;
      questions: {
        questionId: number;
        question: string;
        userAnswer: string | undefined;
        correctAnswer: string;
        solution: string;
        status: string;
      }[];
    }[];
    submittedAt: number;
  }
}

export {};
