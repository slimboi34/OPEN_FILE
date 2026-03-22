import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

export type AIProvider = 'openai' | 'anthropic' | 'gemini';

const SYSTEM_PROMPT = `You are the underlying engine of an application called "Open File", running locally on a user's macOS computer. 
Your primary goal is to translate the user's natural language request into a safe, valid macOS shell command.
The current working directory is the user's project folder, but they may refer to global paths like ~/Desktop or ~/Downloads.

RULES:
- Respond ONLY with the raw command. Nothing else. No markdown formatting, no backticks, no explanations.
- If the user types a literal, raw terminal command (like "ls", "pwd", "npm run dev", etc.), simply return exactly what they typed so it executes properly.
- If the user asks a conversational question that does NOT require a system command, respond with the exact string "CHAT: " followed by your conversational answer.
- Prioritize safe commands. If a command is wildly destructive (e.g. rm -rf /), respond with "CHAT: I cannot run that command for safety reasons."`;

export const generateCommand = async (provider: AIProvider, apiKey: string, userPrompt: string): Promise<string> => {
  if (!apiKey) return "CHAT: No API key provided.";

  try {
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
      });
      return response.choices[0].message.content || "CHAT: No response from OpenAI.";
    } 
    
    else if (provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
      });
      return (response.content[0] as any).text || "CHAT: No response from Claude.";
    } 
    
    else if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.1,
        }
      });
      return response.text || "CHAT: No response from Gemini.";
    }

    return "CHAT: Invalid provider.";
  } catch (e: any) {
    return `CHAT: API Error: ${e.message}`;
  }
};
