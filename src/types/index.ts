/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WhiteboardAction {
  type: 
    | 'text' 
    | 'formula' 
    | 'line' 
    | 'arrow' 
    | 'rectangle' 
    | 'circle' 
    | 'table' 
    | 'label' 
    | 'highlight' 
    | 'underline' 
    | 'clear' 
    | 'graph' 
    | 'geometry';
  x: number; // 0-100%
  y: number; // 0-100%
  content?: string;
  color?: string;
  fontSize?: number; // e.g., 14, 18, 22, 28
  width?: number; // percentage width
  height?: number; // percentage height
  data?: {
    // For graphs:
    fn?: string; // e.g., "sin(x)", "x^2 - 4", "2*x + 1"
    xRange?: [number, number]; // default [-5, 5]
    yRange?: [number, number]; // default [-5, 5]
    label?: string;
    // For geometry:
    shape?: 'triangle' | 'right-triangle' | 'circle-radius' | 'parallel-lines' | 'rectangle';
    angles?: { label: string; degrees?: number; at: 'A' | 'B' | 'C' }[];
    sides?: { label: string; length?: string; side: 'a' | 'b' | 'c' | 'hypotenuse' }[];
    // For tables:
    headers?: string[];
    rows?: string[][];
    // For math step-by-step:
    steps?: { stepNum: number; expr: string; reason?: string }[];
  };
}

export interface WhiteboardStep {
  say: string; // What Sara speaks during this step
  board: WhiteboardAction[]; // Actions drawn during this step
}

export interface StructuredLesson {
  id?: string;
  title: string;
  subject?: string;
  topic?: string;
  createdAt?: string;
  steps: WhiteboardStep[];
}

export interface MCQQuestion {
  id: number;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  topic: string;
}

export interface ExamSession {
  subject: string;
  chapter: string;
  questions: MCQQuestion[];
  userAnswers: Record<number, number>;
  score: number;
  total: number;
  timeSpentSeconds: number;
  date: string;
  weakTopics: string[];
}

export interface UserSettings {
  apiKey: string;
  academicLevel: string; // e.g. "Class 10 (Matric)", "Class 12 (Intermediate)", "Class 9"
  boardExam: string; // e.g. "Bihar Board (BSEB)", "CBSE", "ICSE"
  language: 'Hinglish' | 'English' | 'Hindi';
  textModel: string; // default picked from available models
  ttsModel: string; // default picked from available models
  availableTextModels?: string[]; // real models discovered from key
  availableTtsModels?: string[]; // real speech models discovered from key
  voiceName: 'Leda' | 'Zephyr' | 'Puck' | 'Kore';
  voiceEnergy: 'Calm' | 'Cheerful' | 'Super bubbly';
  whiteboardTheme: 'cream' | 'chalkboard' | 'clean';
  speechInputLang: string; // 'en-IN' | 'hi-IN' | 'en-US'
  darkMode: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  image?: string; // base64 data url
  whiteboardLesson?: StructuredLesson;
  isStreaming?: boolean;
  error?: string;
}

export type SaraMood = 'idle' | 'listening' | 'thinking' | 'talking' | 'happy' | 'sleepy';

export type AnswerStyle =
  | 'Explain simply'
  | 'Explain in detail'
  | 'Exam answer (points to write)'
  | 'Quick revision'
  | 'Quiz me (MCQs)'
  | 'Why did I get this wrong?';

export interface StudentDrawingStroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}
