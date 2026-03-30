import { GoogleGenAI, Type } from "@google/genai";
import { Agent, Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateAgents = async (question: string, language: string): Promise<Agent[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the following question/data: "${question}", identify 5 diverse expert personas (roles) that would be most relevant to debate this. 
    IMPORTANT: All names and roles MUST be written in ${language}.
    Return them as a JSON array of objects with "name", "role", and "color" (hex).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            color: { type: Type.STRING },
          },
          required: ["name", "role", "color"],
        },
      },
    },
  });

  const data = JSON.parse(response.text || "[]");
  return data.map((d: any, i: number) => ({
    id: `agent-${i}`,
    ...d,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${d.name}`,
  }));
};

export const simulateDebate = async (question: string, agents: Agent[], language: string): Promise<Message[]> => {
  const agentDescriptions = agents.map(a => `${a.name} (${a.role})`).join(", ");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Question: "${question}"
    Agents: ${agentDescriptions}
    Language: ${language}
    
    Simulate a heated, argumentative debate between these agents. Each agent should provide one sharp, critical perspective (max 2 sentences) that challenges or builds upon the others. They should "react" to the previous points.
    IMPORTANT: The entire debate MUST be written in ${language}.
    Return the debate as a JSON array of objects with "agentName" and "content".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            agentName: { type: Type.STRING },
            content: { type: Type.STRING },
          },
          required: ["agentName", "content"],
        },
      },
    },
  });

  const data = JSON.parse(response.text || "[]");
  return data.map((d: any) => {
    const agent = agents.find(a => a.name === d.agentName);
    return {
      agentId: agent?.id || "unknown",
      content: d.content,
      timestamp: Date.now(),
    };
  });
};

export const synthesizeForesight = async (question: string, messages: Message[], agents: Agent[], language: string): Promise<string> => {
  const debateText = messages.map(m => {
    const agent = agents.find(a => a.id === m.agentId);
    return `${agent?.name}: ${m.content}`;
  }).join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Question: "${question}"
    Debate Transcript:
    ${debateText}
    Language: ${language}
    
    Based on this debate, provide a "crystal-clear vision" of what's coming next. Synthesize the hidden truths and provide a definitive foresight. Use a professional yet visionary tone.
    IMPORTANT: The entire foresight MUST be written in ${language}.`,
  });

  return response.text || "No foresight generated.";
};
