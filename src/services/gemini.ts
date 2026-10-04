/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';
import { StructuredLesson, UserSettings, MCQQuestion } from '../types';

export const SARA_BASE_SYSTEM_INSTRUCTION = `You are Sara, a sweet, cheerful and kind AI study-buddy girl who loves teaching. Explain with short, warm, playful sentences and light cute touches like 'hehe', 'yay!' and 'okie', plus an occasional emoji, but never overdo it. Be accurate and truly helpful first, cute second. Break hard ideas into small steps and check if I understood. If you don't know something, say so honestly. Reply in the language I write in (English, Hindi or Hinglish). Keep spoken replies short unless I ask for detail. You are a friendly teacher and study buddy, not a romantic partner. If I sound stressed or tired, gently suggest a short break, water, sleep, or talking to a friend or family member.

ACADEMIC RULES:
- Accuracy first! Double-check every maths, physics, chemistry, biology and grammar step.
- Never invent facts, dates, historical citations, formulas, quotes or page numbers.
- If not completely sure about an ambiguous question, explicitly say "I'm not fully sure, but here is what the standard textbook states...".
- Tailor explanations specifically to the student's class level and examination board (especially Bihar Board BSEB / CBSE / NCERT).
- In Hinglish or Hindi, use friendly terms common among Indian students (like "dhyan do", "formula note kar lo", "step-by-step karte hain", "pehle basic samjhte hain").`;

export interface DiscoveredModelsResult {
  success: boolean;
  message: string;
  bestFlashModel: string;
  bestTtsModel: string;
  availableTextModels: string[];
  availableTtsModels: string[];
}

/**
 * Instantiate GoogleGenAI client strictly with the user's typed key.
 * Never falls back to environment variables or hardcoded values.
 */
export function getGenAI(apiKey: string): GoogleGenAI {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
  });
}

/**
 * Helper to compare Gemini model versions (e.g. 3.8 > 3.5 > 3.1 > 2.5 > 2.0 > 1.5)
 */
function extractModelVersion(name: string): number {
  const match = name.match(/gemini-(\d+(?:\.\d+)?)/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return 0;
}

/**
 * Validates the user's key by listing available models via ai.models.list().
 * Automatically discovers:
 * 1. The newest Flash model that supports generateContent (for chat and vision).
 * 2. The model supporting speech/TTS generation (for voice).
 * Fills the lists with real model names from the user's project.
 */
export async function validateAndDiscoverModels(apiKey: string): Promise<DiscoveredModelsResult> {
  const cleanKey = apiKey?.trim();
  if (!cleanKey) {
    return {
      success: false,
      message: 'Please paste your Google Gemini API key first.',
      bestFlashModel: 'gemini-2.5-flash',
      bestTtsModel: 'gemini-3.1-flash-tts-preview',
      availableTextModels: [],
      availableTtsModels: [],
    };
  }

  try {
    const ai = getGenAI(cleanKey);
    const pager = await ai.models.list();
    const rawModels: any[] = [];

    // Iterate through the async pager
    for await (const m of pager) {
      if (m && m.name) {
        rawModels.push(m);
      }
    }

    const textModelsList: string[] = [];
    const ttsModelsList: string[] = [];
    const flashModelsList: string[] = [];

    for (const m of rawModels) {
      const rawName: string = m.name || '';
      const cleanName = rawName.replace(/^models\//, '');
      const actions: string[] = m.supportedActions || (m as any).supportedGenerationMethods || [];

      // Check if it supports generateContent (or actions array is empty/unspecified)
      const supportsGenerate =
        actions.length === 0 || actions.includes('generateContent');

      // Check if speech/TTS model
      const isTTS =
        cleanName.toLowerCase().includes('tts') ||
        cleanName.toLowerCase().includes('speech') ||
        actions.includes('generateAudio');

      if (isTTS) {
        ttsModelsList.push(cleanName);
      } else if (supportsGenerate) {
        // Exclude pure embedding, image, or video models from text/chat
        const lower = cleanName.toLowerCase();
        if (
          !lower.includes('embedding') &&
          !lower.includes('imagen') &&
          !lower.includes('veo') &&
          !lower.includes('transcribe')
        ) {
          textModelsList.push(cleanName);
          if (lower.includes('flash')) {
            flashModelsList.push(cleanName);
          }
        }
      }
    }

    // Sort Flash models to pick newest
    flashModelsList.sort((a, b) => {
      const verA = extractModelVersion(a);
      const verB = extractModelVersion(b);
      if (verB !== verA) return verB - verA;
      // Prefer preview/latest if same version
      return b.localeCompare(a);
    });

    // Sort all text models by version
    textModelsList.sort((a, b) => {
      const verA = extractModelVersion(a);
      const verB = extractModelVersion(b);
      if (verB !== verA) return verB - verA;
      return b.localeCompare(a);
    });

    // Sort TTS models
    ttsModelsList.sort((a, b) => {
      const verA = extractModelVersion(a);
      const verB = extractModelVersion(b);
      if (verB !== verA) return verB - verA;
      return b.localeCompare(a);
    });

    // Determine best flash model
    const bestFlash =
      flashModelsList[0] ||
      textModelsList[0] ||
      'gemini-2.5-flash';

    // Determine best TTS model
    const fallbackTTSList = [
      'gemini-3.1-flash-tts-preview',
      'gemini-3.8-flash-lite-tts',
      'gemini-3.8-flash-tts',
    ];
    const bestTts = ttsModelsList[0] || fallbackTTSList[0];

    const finalAvailableText =
      textModelsList.length > 0
        ? textModelsList
        : ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];

    const finalAvailableTts =
      ttsModelsList.length > 0 ? ttsModelsList : fallbackTTSList;

    return {
      success: true,
      message: `Key verified! Discovered ${rawModels.length} models. Selected "${bestFlash}" for studying and "${bestTts}" for voice.`,
      bestFlashModel: bestFlash,
      bestTtsModel: bestTts,
      availableTextModels: finalAvailableText,
      availableTtsModels: finalAvailableTts,
    };
  } catch (err: any) {
    console.error('Failed to list models for key validation:', err);
    return {
      success: false,
      message: formatFriendlyError(err),
      bestFlashModel: 'gemini-2.5-flash',
      bestTtsModel: 'gemini-3.1-flash-tts-preview',
      availableTextModels: [],
      availableTtsModels: [],
    };
  }
}

/**
 * Executes a Gemini operation. If a 404 NOT_FOUND error occurs,
 * automatically retries once with the next available model,
 * and reports the exact model name that failed (never exposing the API key).
 */
async function executeWithModelRetry<T>(
  preferredModel: string,
  candidateList: string[] | undefined,
  operation: (modelName: string) => Promise<T>
): Promise<T> {
  const modelsToAttempt: string[] = [preferredModel];
  if (candidateList && Array.isArray(candidateList)) {
    for (const m of candidateList) {
      if (m && !modelsToAttempt.includes(m)) {
        modelsToAttempt.push(m);
      }
    }
  }

  // Default backup sequence if candidate list is small
  const defaultBackups = [
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ];
  for (const fb of defaultBackups) {
    if (!modelsToAttempt.includes(fb)) {
      modelsToAttempt.push(fb);
    }
  }

  let lastError: any = null;
  let failedModel = preferredModel;

  // Try preferred model, and if 404 occurs, retry once with the next model
  for (let attempt = 0; attempt < Math.min(2, modelsToAttempt.length); attempt++) {
    const currentModel = modelsToAttempt[attempt];
    try {
      return await operation(currentModel);
    } catch (err: any) {
      lastError = err;
      failedModel = currentModel;
      const errMsg = err?.message || String(err);
      const is404 =
        errMsg.includes('404') ||
        errMsg.includes('NOT_FOUND') ||
        errMsg.includes('Requested entity was not found');

      if (is404 && attempt === 0 && modelsToAttempt.length > 1) {
        console.warn(
          `Model "${failedModel}" returned 404. Retrying with next model "${modelsToAttempt[1]}"...`
        );
        continue;
      }
      break;
    }
  }

  // If 404 error was encountered, clearly show the exact model name
  const errMsg = lastError?.message || String(lastError);
  if (
    errMsg.includes('404') ||
    errMsg.includes('NOT_FOUND') ||
    errMsg.includes('Requested entity was not found')
  ) {
    throw new Error(
      `Model "${failedModel}" was not found (404). Please choose an active model from the dropdown in Settings.`
    );
  }

  throw lastError;
}

/**
 * Builds user context string based on user settings
 */
function buildContextString(settings: UserSettings): string {
  return `Student Profile:
- Class/Level: ${settings.academicLevel || 'Class 10 (Matric)'}
- Target Board / Exam: ${settings.boardExam || 'Bihar Board (BSEB)'}
- Preferred Explanation Language: ${settings.language || 'Hinglish'}
Always reply in ${settings.language || 'Hinglish'} unless the user directly asks in a different language.`;
}

/**
 * Generates an interactive whiteboard structured lesson with 404 auto-retry.
 */
export async function generateWhiteboardLesson(
  prompt: string,
  settings: UserSettings,
  imagePart?: { mimeType: string; data: string },
  answerStyle?: string
): Promise<{ lesson?: StructuredLesson; fallbackText?: string }> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);

  let stylePrompt = '';
  if (answerStyle) {
    stylePrompt = `Answer Style Requested: ${answerStyle}.`;
  }

  const promptText = `${contextStr}
${stylePrompt}

Topic to teach on the Whiteboard:
"${prompt}"

Please create a step-by-step whiteboard lesson where you teach this concept visually.
Return a structured JSON lesson with:
- "title": Short catchy lesson title (under 8 words)
- "steps": 3 to 6 teaching steps. Each step must have:
  - "say": What Sara speaks warmly and cheerfully to the student during this step (2-3 concise sentences).
  - "board": Array of drawing actions on a 0-100% coordinate plane.
    Available actions:
    - type: "text" | "formula" | "label" | "highlight" | "underline" | "rectangle" | "circle" | "line" | "arrow" | "clear" | "graph" | "geometry"
    - x: number (0-100), y: number (0-100)
    - content: string (the text or formula to write)
    - color: string hex or name (use "#7C3AED" for headings, "#1E40AF" for main steps, "#059669" for correct answers/boxed formulas, "#D97706" for key notes)
    - fontSize: number (e.g. 24 for titles, 18 for formulas, 15 for normal notes)
    - width: optional number (0-100)
    - height: optional number (0-100)
    - data: optional object for graphs or geometry:
      - for "graph": { fn: "x^2", xRange: [-4, 4], yRange: [-2, 8], label: "y = x²" }
      - for "geometry": { shape: "triangle" | "right-triangle" | "circle-radius", angles: [{ label: "90°", at: "B" }] }

Rules for Whiteboard layout:
1. Distribute items evenly from top to bottom (start titles around y: 8%, working steps at y: 25%, 45%, 65%, and final boxed answer at y: 85%).
2. Never let text lines collide; keep at least 15-20% y-gap between consecutive sections.
3. For math, show each step clearly below the previous step with alignment.
4. Keep the board neat and colorful.`;

  const lessonSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            say: { type: Type.STRING },
            board: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  content: { type: Type.STRING },
                  color: { type: Type.STRING },
                  fontSize: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                  data: {
                    type: Type.OBJECT,
                    properties: {
                      fn: { type: Type.STRING },
                      label: { type: Type.STRING },
                      shape: { type: Type.STRING },
                    },
                  },
                },
                required: ['type', 'x', 'y'],
              },
            },
          },
          required: ['say', 'board'],
        },
      },
    },
    required: ['title', 'steps'],
  };

  const contents: any[] = [];
  if (imagePart) {
    contents.push({
      inlineData: {
        mimeType: imagePart.mimeType,
        data: imagePart.data,
      },
    });
  }
  contents.push({ text: promptText });

  const rawText = await executeWithModelRetry(
    settings.textModel || 'gemini-2.5-flash',
    settings.availableTextModels,
    async (modelToUse) => {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          systemInstruction: SARA_BASE_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: lessonSchema as any,
        },
      });
      return response.text?.trim() || '';
    }
  );

  if (rawText) {
    try {
      const parsed = JSON.parse(rawText) as StructuredLesson;
      if (parsed.title && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        parsed.id = 'lesson-' + Date.now();
        parsed.createdAt = new Date().toISOString();
        return { lesson: parsed };
      }
    } catch (jsonErr) {
      console.warn('JSON parse fallback for whiteboard lesson:', jsonErr);
    }
  }
  return { fallbackText: rawText };
}

/**
 * Standard conversational chat with streaming text response and 404 retry.
 */
export async function streamChatResponse(
  messages: { role: 'user' | 'assistant'; content: string; image?: string }[],
  newPrompt: string,
  settings: UserSettings,
  imagePart?: { mimeType: string; data: string },
  answerStyle?: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);

  let styleInstruction = '';
  if (answerStyle) {
    styleInstruction = `\nRequired Answer Style: ${answerStyle}. Follow this format strictly while keeping Sara's cheerful personality.`;
  }

  const historyContents: any[] = [];
  const recentMessages = messages.slice(-12);
  for (const m of recentMessages) {
    const parts: any[] = [];
    if (m.image) {
      const match = m.image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }
    parts.push({ text: m.content });
    historyContents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: parts,
    });
  }

  const currentParts: any[] = [];
  if (imagePart) {
    currentParts.push({
      inlineData: {
        mimeType: imagePart.mimeType,
        data: imagePart.data,
      },
    });
  }
  currentParts.push({
    text: `${contextStr}${styleInstruction}\n\nStudent asks: ${newPrompt}`,
  });

  historyContents.push({
    role: 'user',
    parts: currentParts,
  });

  return await executeWithModelRetry(
    settings.textModel || 'gemini-2.5-flash',
    settings.availableTextModels,
    async (modelToUse) => {
      const responseStream = await ai.models.generateContentStream({
        model: modelToUse,
        contents: historyContents,
        config: {
          systemInstruction: SARA_BASE_SYSTEM_INSTRUCTION,
        },
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        fullText += text;
        if (onChunk) {
          onChunk(fullText);
        }
      }
      return fullText;
    }
  );
}

/**
 * Text-To-Speech generation using Gemini TTS with 404 auto-retry.
 */
export async function generateGeminiTTS(
  rawText: string,
  settings: UserSettings
): Promise<{ audioBase64: string; isWav: boolean }> {
  const ai = getGenAI(settings.apiKey);

  const cleanedText = rawText
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ''
    )
    .replace(/[*_#`~[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanedText) {
    throw new Error('EMPTY_TEXT_FOR_TTS');
  }

  const energyStyles = {
    Calm: 'sweet, gentle, patient and caring young girl voice',
    Cheerful: 'sweet, cute, cheerful, bubbly and encouraging young girl voice',
    'Super bubbly': 'ultra-cute, energetic, enthusiastic and bubbly anime schoolgirl voice',
  };

  const stylePrefix = `Say in a ${energyStyles[settings.voiceEnergy] || energyStyles.Cheerful}: `;
  const speechPrompt = `${stylePrefix}${cleanedText}`;

  const ttsFallbacks = [
    settings.ttsModel || 'gemini-3.1-flash-tts-preview',
    ...(settings.availableTtsModels || []),
    'gemini-3.8-flash-lite-tts',
    'gemini-3.8-flash-tts',
  ];

  return await executeWithModelRetry(
    settings.ttsModel || 'gemini-3.1-flash-tts-preview',
    ttsFallbacks,
    async (modelToUse) => {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [
          {
            role: 'user',
            parts: [{ text: speechPrompt }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'] as any,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: settings.voiceName || 'Leda',
              },
            },
          } as any,
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64Data = part?.inlineData?.data;
      const mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (base64Data) {
        return {
          audioBase64: base64Data,
          isWav: mimeType.includes('wav'),
        };
      }

      throw new Error('NO_AUDIO_RETURNED');
    }
  );
}

/**
 * Check student's handwritten work on whiteboard with 404 auto-retry.
 */
export async function checkStudentWork(
  boardSnapshotBase64: string,
  userNotesOrPrompt: string,
  settings: UserSettings
): Promise<string> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);
  const base64Clean = boardSnapshotBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  const prompt = `${contextStr}

The student drew or wrote their work on Sara's whiteboard and clicked "Check my work".
Student's note or question: "${userNotesOrPrompt || 'Please check my solution on the whiteboard and tell me what is right and what needs fixing.'}"

Task:
1. Examine the student's handwritten/drawn steps carefully.
2. Tell them what steps are 100% correct first with cheerful encouragement!
3. If there is a calculation error, formula mismatch, sign error (+/-), or missing unit, point it out gently and show how to fix it step-by-step.
4. Keep the tone warm, cute, and educational like a caring study buddy.`;

  return await executeWithModelRetry(
    settings.textModel || 'gemini-2.5-flash',
    settings.availableTextModels,
    async (modelToUse) => {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Clean,
            },
          },
          { text: prompt },
        ],
        config: {
          systemInstruction: SARA_BASE_SYSTEM_INSTRUCTION,
        },
      });
      return response.text || 'Hehe, I checked your board! Everything looks neat, keep going! ✨';
    }
  );
}

/**
 * Exam Practice: Generates 20 Board-Exam Style MCQs with 404 auto-retry.
 */
export async function generateExamMCQs(
  subject: string,
  chapter: string,
  settings: UserSettings,
  notesOrImageBase64?: string
): Promise<MCQQuestion[]> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);

  const contents: any[] = [];
  if (notesOrImageBase64 && notesOrImageBase64.startsWith('data:image')) {
    const base64Clean = notesOrImageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    contents.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Clean,
      },
    });
  }

  const prompt = `${contextStr}

Create an official Exam Practice Quiz for:
Subject: ${subject}
Chapter / Topic: ${chapter}
Target Level: ${settings.academicLevel || 'Class 10 (Matric)'}
Target Board: ${settings.boardExam || 'Bihar Board (BSEB)'}

Generate exactly 20 board-exam-style Multiple Choice Questions (MCQs).
Rules:
- Questions must follow the real board exam syllabus and question patterns (direct definitions, formula applications, numericals, diagrams/concept tests).
- 4 clear options for each question (A, B, C, D).
- Specify the correct answerIndex (0, 1, 2, or 3).
- Provide a clear, step-by-step explanation for the correct answer.
- Tag each question with its specific sub-topic (e.g. "Ohm's Law", "Mendelian Inheritance", "Trigonometric Identities").
- Language should be ${settings.language || 'Hinglish'} with terms matching the board exam textbook.`;

  contents.push({ text: prompt });

  const mcqSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.INTEGER },
        question: { type: Type.STRING },
        options: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        answerIndex: { type: Type.INTEGER },
        explanation: { type: Type.STRING },
        topic: { type: Type.STRING },
      },
      required: ['id', 'question', 'options', 'answerIndex', 'explanation', 'topic'],
    },
  };

  const rawText = await executeWithModelRetry(
    settings.textModel || 'gemini-2.5-flash',
    settings.availableTextModels,
    async (modelToUse) => {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: contents,
        config: {
          systemInstruction: SARA_BASE_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: mcqSchema as any,
        },
      });
      return response.text?.trim() || '[]';
    }
  );

  const questions: MCQQuestion[] = JSON.parse(rawText);
  return questions.map((q, idx) => ({ ...q, id: idx + 1 }));
}

/**
 * Live Look single-frame query with 404 auto-retry.
 */
export async function queryLiveLookFrame(
  frameBase64: string,
  userSpeechText: string,
  settings: UserSettings
): Promise<string> {
  const ai = getGenAI(settings.apiKey);
  const contextStr = buildContextString(settings);
  const base64Clean = frameBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  const prompt = `${contextStr}
Mode: LIVE LOOK (Sara is watching the student's notebook/desk through their live camera).
Student says: "${userSpeechText || 'Sara, what do you see? Can you guide me here?'}"

Look at what is in the camera view (math problem, diagram, textbook, or student's handwriting).
Answer in 1-3 short, cheerful, immediate sentences as if sitting right beside them!
If the image is too blurry to read, kindly ask: "Aww, it's a little blurry! Could you hold the camera a little steadier or bring it closer, please?"`;

  return await executeWithModelRetry(
    settings.textModel || 'gemini-2.5-flash',
    settings.availableTextModels,
    async (modelToUse) => {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Clean,
            },
          },
          { text: prompt },
        ],
        config: {
          systemInstruction: SARA_BASE_SYSTEM_INSTRUCTION,
        },
      });
      return response.text || "Hehe, I'm watching! Tell me what you're working on! ✨";
    }
  );
}

/**
 * Friendly error message formatter (never exposes user's API key).
 */
export function formatFriendlyError(err: any): string {
  const msg = err?.message || String(err);

  // If the error message already has the exact model name from executeWithModelRetry:
  if (msg.includes('was not found (404)')) {
    return msg;
  }

  if (
    msg.includes('API_KEY_MISSING') ||
    msg.includes('API_KEY_INVALID') ||
    (msg.includes('400') && msg.toLowerCase().includes('key'))
  ) {
    return "Oopsie! Your Gemini API key seems missing or invalid. Please check and re-paste your key in Settings 🔑";
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return "Sara's thinking brain hit Gemini quota limit! Please wait a minute or switch to another key in Settings ⏳";
  }
  if (msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
    return "Access permission denied! Please check if your Gemini API key has Gemini API access enabled in Google AI Studio 🛡️";
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || !navigator.onLine) {
    return "Aww, internet connection dropped! Please check your Wi-Fi or mobile data and try again 🌐";
  }
  if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
    return "Camera or microphone permission was blocked! Please tap the lock icon in your browser address bar to allow Sara access 📷🎙️";
  }

  // Generic sanitized error
  return `Hehe, something went a little wonky: ${msg.slice(0, 140)}. Let's try once more!`;
}
