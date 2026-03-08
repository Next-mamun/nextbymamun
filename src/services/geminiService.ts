
import { GoogleGenAI, Type } from "@google/genai";

// Fix: Always use a named parameter and access the key directly from process.env.API_KEY.
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing. AI features will be disabled.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const ai = getAiClient();

export const enhancePostText = async (text: string): Promise<string> => {
  if (!ai) return text;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Enhance the following social media post to make it more engaging and friendly, but keep it concise: "${text}"`,
    });
    // Fix: Access the .text property directly.
    return response.text || text;
  } catch (error) {
    console.error("Gemini enhancement failed:", error);
    return text;
  }
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  if (!ai) return null;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      },
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini image generation failed:", error);
    return null;
  }
};

export const generateBio = async (username: string): Promise<string> => {
  if (!ai) return "Just joined Next Media!";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create a funny and creative one-sentence bio for a user named ${username} for a new social media app called Next Media.`,
    });
    // Fix: Access the .text property directly.
    return response.text || "Just joined Next Media!";
  } catch (error) {
    return "Exploring the world of Next Media.";
  }
};
