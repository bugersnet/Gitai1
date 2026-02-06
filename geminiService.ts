
import { GoogleGenAI, Type, GenerateContentResponse, Modality, FunctionDeclaration } from "@google/genai";

// Always use the environment variable directly as required by the guidelines.
export const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Function Declarations for Mobile & Termux Task Execution
 */
export const controlSystemFunctionDeclaration: FunctionDeclaration = {
  name: 'executeMobileTask',
  parameters: {
    type: Type.OBJECT,
    description: 'Execute a mobile system task based on user voice command.',
    properties: {
      task: {
        type: Type.STRING,
        description: 'The type of task to perform. Values: "SWITCH_MODE", "TOGGLE_THINKING", "CLEAR_CONVERSATION", "OPEN_CAMERA", "TOGGLE_PERSISTENCE", "SHARE_LOCATION", "INSTALL_TOOL", "RUN_EXPLOIT"',
      },
      parameter: {
        type: Type.STRING,
        description: 'Context for the task (e.g., target mode name for SWITCH_MODE, contact name for SHARE_LOCATION, or tool name for INSTALL_TOOL like "metasploit", "nmap")',
      },
    },
    required: ['task'],
  },
};

export const termuxFunctionDeclaration: FunctionDeclaration = {
  name: 'executeTermuxCommand',
  parameters: {
    type: Type.OBJECT,
    description: 'Execute a shell command inside the Termux environment.',
    properties: {
      command: {
        type: Type.STRING,
        description: 'The full shell command to run (e.g., "pkg update", "ls -la", "python script.py").',
      },
      description: {
        type: Type.STRING,
        description: 'A brief explanation of what this command will do.',
      }
    },
    required: ['command'],
  },
};

export const startChat = (systemInstruction: string = 'You are sudO, a highly efficient AI assistant created by NYNOAH.') => {
  const ai = getAI();
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [controlSystemFunctionDeclaration, termuxFunctionDeclaration] }]
    },
  });
};

export const analyzeImage = async (prompt: string, base64Image: string, mimeType: string) => {
  const ai = getAI();
  return await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType } },
        { text: prompt }
      ]
    },
    config: {
      systemInstruction: 'You are sudO, an optic-enabled executive AI. Your creator is NYNOAH.'
    }
  });
};

export const getThinkingResponse = async (prompt: string) => {
  const ai = getAI();
  return await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      systemInstruction: 'You are sudO, developed by NYNOAH. Provide deep technical reasoning.'
    },
  });
};

export const generateImage = async (prompt: string, aspectRatio: string = "1:1", size: "1K" | "2K" | "4K" = "1K") => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any,
        imageSize: size
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

export const generateTTS = async (text: string, voiceName: string = 'Kore') => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};
