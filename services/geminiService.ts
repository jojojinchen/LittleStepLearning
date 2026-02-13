
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Question, Subject, QuestionCount, YearLevel } from "../types";

export const generateQuestions = async (
  subject: Subject,
  count: QuestionCount,
  yearLevel: YearLevel
): Promise<Question[]> => {
  // Create instance right before API call and use API_KEY directly
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview";
  
  const prompt = `Generate ${count} NAPLAN-style practice questions specifically for an Australian Year ${yearLevel} student in the subject of ${subject}. 
  The difficulty level and content MUST strictly align with the Australian Curriculum Version 9.0 (v9.0) for Year ${yearLevel}.
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

export const speakText = async (text: string): Promise<AudioBuffer> => {
  // Create instance right before API call and use API_KEY directly
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Please read this question clearly for a young student: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const audioData = decodeBase64(base64Audio);
  
  // Custom decoding for raw PCM from Gemini TTS
  const dataInt16 = new Int16Array(audioData.buffer);
  const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
};

// Implement manual decode function as required by guidelines
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
