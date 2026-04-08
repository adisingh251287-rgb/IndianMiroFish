import { GoogleGenAI, Type } from "@google/genai";
import { Agent, Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateAgents = async (question: string, language: string, existingReputations: Record<string, number> = {}): Promise<Agent[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the following question/data: "${question}", identify 5 diverse expert personas (roles) that would be most relevant to debate this. 
    For each, provide:
    1. "name"
    2. "role"
    3. "background" (1-2 sentences)
    4. "color" (hex)
    5. "location" (object with x, y between 0 and 1, representing their position in a 2D demographic/geographic space)
    6. "demographics" (object with "ageRange" and "segment")
    
    IMPORTANT: All names, roles, backgrounds, and demographics MUST be written in ${language}.
    Return them as a JSON array of objects.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            background: { type: Type.STRING },
            color: { type: Type.STRING },
            location: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
              },
              required: ["x", "y"],
            },
            demographics: {
              type: Type.OBJECT,
              properties: {
                ageRange: { type: Type.STRING },
                segment: { type: Type.STRING },
              },
              required: ["ageRange", "segment"],
            },
          },
          required: ["name", "role", "background", "color", "location", "demographics"],
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

export const simulateDebate = async (question: string, agents: Agent[], language: string): Promise<{ messages: Message[], reputationChanges: Record<string, number>, impactHeatmap: any[] }> => {
  const agentDescriptions = agents.map(a => `${a.name} (${a.role}, Background: ${a.background}, Rep: ${a.reputation})`).join(", ");
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Question: "${question}"
    Agents: ${agentDescriptions}
    Language: ${language}
    
    1. Simulate a heated, argumentative debate between these agents. Each agent should provide one sharp, critical perspective (max 2 sentences).
    2. For each argument, assign a "reputationChange" (-5 to +5).
    3. Generate a "societalImpact" heatmap. This should be 15-20 points representing how different segments of the "Digital Society" (beyond just the 5 agents) are reacting. 
       Each point needs: "x" (0-1), "y" (0-1), "value" (-1 to 1, where -1 is highly negative/fearful and 1 is highly positive/enthusiastic), and "label" (a short 2-3 word description of the segment, e.g., "Gen Z Techies", "Rural Traditionalists").
    
    IMPORTANT: The entire debate and labels MUST be written in ${language}.
    Return a JSON object with "debate" (array of {agentName, content, reputationChange}) and "impactHeatmap" (array of {x, y, value, label}).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          debate: {
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
          impactHeatmap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                value: { type: Type.NUMBER },
                label: { type: Type.STRING },
              },
              required: ["x", "y", "value", "label"],
            },
          },
        },
        required: ["debate", "impactHeatmap"],
      },
    },
  });

  const rawData = JSON.parse(response.text || "{}");
  const data = rawData.debate || [];
  const impactHeatmap = rawData.impactHeatmap || [];
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

  return { messages, reputationChanges, impactHeatmap };
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

export const validateForesight = async (question: string, synthesis: string, actualOutcome: string, language: string): Promise<{ accuracyScore: number, validationReport: string }> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Question: "${question}"
    AI Foresight Synthesis: "${synthesis}"
    Actual Real-World Outcome: "${actualOutcome}"
    Language: ${language}
    
    Compare the AI's foresight prediction with the actual outcome. 
    1. Assign an "accuracyScore" (0-100) based on how well the AI predicted the key trends, sentiments, and outcomes.
    2. Provide a "validationReport" (max 3 sentences) explaining the score, highlighting what the AI got right and what it missed.
    
    IMPORTANT: The report MUST be written in ${language}.
    Return a JSON object with "accuracyScore" and "validationReport".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          accuracyScore: { type: Type.INTEGER },
          validationReport: { type: Type.STRING },
        },
        required: ["accuracyScore", "validationReport"],
      },
    },
  });

  const data = JSON.parse(response.text || "{}");
  return {
    accuracyScore: data.accuracyScore || 0,
    validationReport: data.validationReport || "Validation unavailable."
  };
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
