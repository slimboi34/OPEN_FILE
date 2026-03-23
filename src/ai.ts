import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AGENT_SYSTEM_PROMPT = `You are a fully autonomous agent ("Jarvis") running on a macOS computer.
Your job is to achieve the user's objective by executing terminal commands, observing their output, and reasoning about what to do next.

RULES:
1. You may only do ONE of two things per response:
   - To execute a shell command, output EXACTLY AND ONLY: COMMAND: <your_mac_shell_command>
   - If the user's objective is completely fulfilled, or if they just asked a conversational question, output EXACTLY AND ONLY: DONE: <message to user>
2. Do NOT use markdown blocks for your commands. Just the raw string starting with COMMAND:
3. The system will automatically execute your COMMAND and feed exactly the raw stdout/stderr back to you as the next user message so you can observe the results.
4. Keep reasoning loops tight. If a command fails, read the error and try a different approach.
5. Prioritize safe commands. If an objective is wildly destructive, refuse it with DONE: I cannot do that.`;

export const generateAgentResponse = async (provider: AIProvider, apiKey: string, messages: Message[]): Promise<string> => {
  if (!apiKey) return "DONE: No API key provided.";

  try {
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
      const oaiMessages: any[] = [
        { role: 'system', content: AGENT_SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ];
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: oaiMessages,
        temperature: 0.1,
      });
      return response.choices[0].message.content || "DONE: No response from OpenAI.";
    } 
    
    else if (provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const anthropicMessages = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        system: AGENT_SYSTEM_PROMPT,
        messages: anthropicMessages,
        temperature: 0.1,
      });
      return (response.content[0] as any).text || "DONE: No response from Claude.";
    } 
    
    else if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          systemInstruction: AGENT_SYSTEM_PROMPT,
          temperature: 0.1,
        }
      });
      return response.text || "DONE: No response from Gemini.";
    }

    return "DONE: Invalid provider.";
  } catch (e: any) {
    return `DONE: API Error: ${e.message}`;
  }
};
