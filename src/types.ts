export interface Agent {
  id: string;
  name: string;
  role: string;
  background: string;
  avatar: string;
  color: string;
  reputation: number;
  location: { x: number; y: number }; // Normalized 0-1
  demographics: {
    ageRange: string;
    segment: string;
  };
}

export interface ImpactPoint {
  x: number;
  y: number;
  value: number; // -1 to 1 (sentiment)
  label: string;
}

export interface Message {
  agentId: string;
  content: string;
  timestamp: number;
}

export interface ValidationData {
  actualOutcome: string;
  accuracyScore: number; // 0-100
  validationReport: string;
  validatedAt: number;
}

export interface HistoryItem {
  id: string;
  question: string;
  agents: Agent[];
  messages: Message[];
  synthesis: string;
  impactHeatmap?: ImpactPoint[];
  validation?: ValidationData;
  timestamp: number;
}

export interface SimulationState {
  status: 'idle' | 'initializing' | 'reviewing_agents' | 'simulating' | 'synthesizing' | 'completed' | 'error';
  question: string;
  language: string;
  agents: Agent[];
  messages: Message[];
  synthesis?: string;
  impactHeatmap?: ImpactPoint[];
  validation?: ValidationData;
  error?: string;
  history: HistoryItem[];
}
