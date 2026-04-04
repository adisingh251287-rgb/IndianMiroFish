import { GoogleGenAI, Type } from "@google/genai";
import { Agent, Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateAgents = async (question: string, language: string, existingReputations: Record<string, number> = {}): Promise<Agent[]> => {
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
    reputation: existingReputations[d.role] || 100, // Default to 100
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${d.name}`,
  }));
};

export const simulateDebate = async (question: string, agents: Agent[], language: string): Promise<{ messages: Message[], reputationChanges: Record<string, number> }> => {
  const agentDescriptions = agents.map(a => `${a.name} (${a.role}, Rep: ${a.reputation})`).join(", ");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Question: "${question}"
    Agents: ${agentDescriptions}
    Language: ${language}
    
    Simulate a heated, argumentative debate between these agents. Each agent should provide one sharp, critical perspective (max 2 sentences) that challenges or builds upon the others. They should "react" to the previous points.
    
    CRITICAL: For each argument, assign a "reputationChange" (integer between -5 and +5) based on the validity, impact, and logical strength of the argument.
    
    IMPORTANT: The entire debate MUST be written in ${language}.
    Return the debate as a JSON array of objects with "agentName", "content", and "reputationChange".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            agentName: { type: Type.STRING },
            content: { type: Type.STRING },
            reputationChange: { type: Type.INTEGER },
          },
          required: ["agentName", "content", "reputationChange"],
        },
      },
    },
  });

  const data = JSON.parse(response.text || "[]");
  const reputationChanges: Record<string, number> = {};
  
  const messages = data.map((d: any) => {
    const agent = agents.find(a => a.name === d.agentName);
    if (agent) {
      reputationChanges[agent.id] = (reputationChanges[agent.id] || 0) + d.reputationChange;
    }
    return {
      agentId: agent?.id || "unknown",
      content: d.content,
      timestamp: Date.now(),
    };
  });

  return { messages, reputationChanges };
};

export const synthesizeForesight = async (question: string, messages: Message[], agents: Agent[], language: string): Promise<string> => {
  const debateText = messages.map(m => {
    const agent = agents.find(a => a.id === m.agentId);
    return `${agent?.name} (Reputation: ${agent?.reputation}): ${m.content}`;
  }).join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Question: "${question}"
    Debate Transcript (with agent reputations):
    ${debateText}
    Language: ${language}
    
    Based on this debate, provide a "crystal-clear vision" of what's coming next. Give more weight to arguments from agents with higher reputation scores. Synthesize the hidden truths and provide a definitive foresight. Use a professional yet visionary tone.
    IMPORTANT: The entire foresight MUST be written in ${language}.`,
  });

  return response.text || "No foresight generated.";
};

export const generateAvatar = async (role: string, name: string, customPrompt?: string): Promise<string> => {
  const prompt = customPrompt 
    ? `A professional, high-quality avatar portrait for a "${role}" named "${name}". ${customPrompt}. The style should be clean, modern, and suitable for a digital society simulation. 1:1 aspect ratio.`
    : `A professional, high-quality avatar portrait for a "${role}" named "${name}". The style should be clean, modern, and suitable for a digital society simulation. 3D render style, soft lighting, neutral background.`;

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
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64EncodeString = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }
  
  // Fallback to DiceBear if image generation fails
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${name}-${Date.now()}`;
};
