declare interface TokenPayload {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

declare interface Option {
  a: string;
  b: string;
  c: string;
  d: string;
  e?: string;
}

declare interface AlocQuestionType {
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
