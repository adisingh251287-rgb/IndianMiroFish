export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
}

export interface Message {
  agentId: string;
  content: string;
  timestamp: number;
}

export interface HistoryItem {
  id: string;
  question: string;
  agents: Agent[];
  messages: Message[];
  synthesis: string;
  timestamp: number;
}

export interface SimulationState {
  status: 'idle' | 'initializing' | 'simulating' | 'synthesizing' | 'completed' | 'error';
  question: string;
  language: string;
  agents: Agent[];
  messages: Message[];
  synthesis?: string;
  error?: string;
  history: HistoryItem[];
}
