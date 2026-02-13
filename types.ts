
export enum Subject {
  MATH = 'Mathematics',
  ENGLISH = 'English Literacy'
}

export type QuestionCount = 10 | 20 | 30 | 50;

export type YearLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  category: string;
}

export interface TestResult {
  score: number;
  totalQuestions: number;
  yearLevel: YearLevel;
  answers: {
    questionId: string;
    selectedOption: number;
    isCorrect: boolean;
  }[];
  subject: Subject;
  timestamp: number;
}

export type AppState = 'setup' | 'loading' | 'testing' | 'results';
