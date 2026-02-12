
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Subject, QuestionCount, YearLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateQuestions = async (
  subject: Subject,
  count: QuestionCount,
  yearLevel: YearLevel
): Promise<Question[]> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Generate ${count} NAPLAN-style practice questions specifically for an Australian Year ${yearLevel} student in the subject of ${subject}. 
  The difficulty level and content MUST strictly align with the Australian Curriculum for Year ${yearLevel}.
  Ensure the questions vary in difficulty and cover standard curriculum areas like ${subject === Subject.MATH ? 'number sense, algebra, geometry, and statistics' : 'reading comprehension, grammar, punctuation, and spelling'}.
  Each question MUST be multiple choice with exactly 4 options. 
  Include a clear explanation for each answer that a Year ${yearLevel} student could understand.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "The question text." },
            options: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Array of exactly 4 strings for options."
            },
            correctAnswerIndex: { 
              type: Type.INTEGER, 
              description: "The 0-based index of the correct answer." 
            },
            explanation: { 
              type: Type.STRING, 
              description: "Brief explanation of why the answer is correct." 
            },
            category: { 
              type: Type.STRING, 
              description: "The specific sub-topic (e.g., Algebra, Grammar)." 
            }
          },
          required: ["text", "options", "correctAnswerIndex", "explanation", "category"]
        }
      }
    }
  });

  const rawJson = response.text.trim();
  const questions: any[] = JSON.parse(rawJson);

  return questions.map((q, idx) => ({
    ...q,
    id: `q-${idx}-${Date.now()}`
  }));
};
