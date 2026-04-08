import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Fish, 
  Sparkles, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  ArrowRight,
  RefreshCcw,
  AlertCircle,
  ChevronRight,
  History,
  Share2,
  Copy,
  Check,
  Trash2,
  Clock,
  Download,
  Globe,
  Mic,
  MicOff,
  Target
} from 'lucide-react';
import { Agent, Message, SimulationState, HistoryItem, ValidationData } from './types';
import { generateAgents, simulateDebate, synthesizeForesight, generateAvatar, validateForesight } from './services/gemini';
import { TRANSLATIONS } from './translations';
import { db, auth, signIn, signOut, handleFirestoreError, OperationType } from './firebase';
import { doc, onSnapshot, setDoc, updateDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  state: { hasError: boolean, error: any };
  props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        errorMessage = `Firestore Error: ${parsed.error} (${parsed.operationType} at ${parsed.path})`;
      } catch (e) {
        errorMessage = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen bg-[#0a0502] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Application Error</h2>
            <p className="text-sm opacity-60 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-[#ff4e00] rounded-xl font-bold hover:bg-[#ff6a26] transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PREMADE_AVATAR_STYLES = [
  { name: 'Robots', value: 'bottts' },
  { name: 'Avatars', value: 'avataaars' },
  { name: 'Pixel Art', value: 'pixel-art' },
  { name: 'Big Ears', value: 'big-ears' },
  { name: 'Miniavs', value: 'miniavs' },
  { name: 'Croodles', value: 'croodles' },
  { name: 'Fun Emoji', value: 'fun-emoji' },
  { name: 'Lorelei', value: 'lorelei' },
  { name: 'Notionists', value: 'notionists' },
  { name: 'Open Peeps', value: 'open-peeps' },
  { name: 'Personas', value: 'personas' },
];

const LANGUAGES = [
  { label: 'English', value: 'English', code: 'en-US' },
  { label: 'Hindi (हिन्दी)', value: 'Hindi', code: 'hi-IN' },
  { label: 'Bengali (বাংলা)', value: 'Bengali', code: 'bn-IN' },
  { label: 'Tamil (தமிழ்)', value: 'Tamil', code: 'ta-IN' },
  { label: 'Telugu (తెలుగు)', value: 'Telugu', code: 'te-IN' },
  { label: 'Marathi (मराठी)', value: 'Marathi', code: 'mr-IN' },
  { label: 'Gujarati (ગુજરાતી)', value: 'Gujarati', code: 'gu-IN' },
  { label: 'Kannada (ಕನ್ನಡ)', value: 'Kannada', code: 'kn-IN' },
  { label: 'Malayalam (മലയാളം)', value: 'Malayalam', code: 'ml-IN' },
  { label: 'Punjabi (ਪੰਜਾਬੀ)', value: 'Punjabi', code: 'pa-IN' },
  { label: 'Spanish', value: 'Spanish', code: 'es-ES' },
  { label: 'French', value: 'French', code: 'fr-FR' },
  { label: 'German', value: 'German', code: 'de-DE' },
];

import { SocietalHeatmap } from './components/SocietalHeatmap';
import { AccuracyDashboard } from './components/AccuracyDashboard';
import { BarChart2, CheckCircle2, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function App() {
  const [state, setState] = useState<SimulationState>({
    status: 'idle',
    question: '',
    language: 'English',
    agents: [],
    messages: [],
    history: [],
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCustomizingAgent, setIsCustomizingAgent] = useState<string | null>(null);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [customAvatarPrompt, setCustomAvatarPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [presence, setPresence] = useState<{ uid: string, displayName: string, photoURL: string }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [agentReputations, setAgentReputations] = useState<Record<string, number>>({});
  const [user, setUser] = useState<User | null>(null);
  const [hasPaid, setHasPaid] = useState<boolean | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showConfigError, setShowConfigError] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(window.location.hash.slice(1) || null);
  const [activeTab, setActiveTab] = useState<'simulation' | 'dashboard'>('simulation');
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [validationInput, setValidationInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({
    query: '',
    startDate: '',
    endDate: '',
    agentRole: ''
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth listener and payment status
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Fetch payment status
        const userDoc = doc(db, 'users', u.uid);
        const unsubscribe = onSnapshot(userDoc, (snapshot) => {
          if (snapshot.exists()) {
            setHasPaid(snapshot.data().hasPaid || false);
          } else {
            // Create initial user doc
            setDoc(userDoc, {
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              hasPaid: false,
              createdAt: Date.now()
            }, { merge: true });
            setHasPaid(false);
          }
        });
        return () => unsubscribe();
      } else {
        setHasPaid(null);
      }
    });
  }, []);

  // Hash listener for session ID
  useEffect(() => {
    const handleHashChange = () => {
      setSessionId(window.location.hash.slice(1) || null);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle payment success/cancel from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    if (paymentStatus === 'success') {
      // We could show a toast here
      console.log('Payment successful!');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    } else if (paymentStatus === 'cancel') {
      console.log('Payment cancelled.');
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }, []);

  // Real-time sync for shared session
  useEffect(() => {
    if (!sessionId || !user) return;

    const path = `simulations/${sessionId}`;
    const unsubscribe = onSnapshot(doc(db, 'simulations', sessionId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Only update if we are NOT the one currently simulating (to avoid local state conflicts)
        // Or if the status is different
        setState(prev => {
          if (prev.status === 'simulating' && data.status === 'simulating' && data.messages.length <= prev.messages.length) {
            return prev;
          }

          // Merge agents to avoid overwriting local edits
          let mergedAgents = data.agents;
          if (editingAgentId) {
            mergedAgents = data.agents.map((remoteAgent: Agent) => {
              if (remoteAgent.id === editingAgentId) {
                const localAgent = prev.agents.find(a => a.id === editingAgentId);
                return localAgent || remoteAgent;
              }
              return remoteAgent;
            });
          }

          return {
            ...prev,
            question: data.question,
            language: data.language,
            status: data.status,
            agents: mergedAgents,
            messages: data.messages,
            synthesis: data.synthesis,
            error: data.error
          };
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    // Presence tracking
    const presenceRef = doc(db, `simulations/${sessionId}/presence`, user.uid);
    setDoc(presenceRef, {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastSeen: Date.now()
    }, { merge: true });

    const presenceUnsubscribe = onSnapshot(collection(db, `simulations/${sessionId}/presence`), (snapshot) => {
      const activeUsers = snapshot.docs
        .map(d => d.data() as any)
        .filter(u => Date.now() - u.lastSeen < 60000); // Only show users active in last minute
      setPresence(activeUsers);
    });

    const heartbeat = setInterval(() => {
      updateDoc(presenceRef, { lastSeen: Date.now() });
    }, 30000);

    return () => {
      unsubscribe();
      presenceUnsubscribe();
      clearInterval(heartbeat);
    };
  }, [sessionId, user]);

  // Load history, reputations, and draft question from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('mirofish_history');
    const savedReputations = localStorage.getItem('mirofish_reputations');
    const savedDraft = localStorage.getItem('mirofish_draft_question');
    
    if (savedHistory) {
      try {
        setState(prev => ({ ...prev, history: JSON.parse(savedHistory) }));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    if (savedReputations) {
      try {
        setAgentReputations(JSON.parse(savedReputations));
      } catch (e) {
        console.error("Failed to parse reputations", e);
      }
    }

    if (savedDraft) {
      setState(prev => ({ ...prev, question: savedDraft }));
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('mirofish_history', JSON.stringify(state.history));
  }, [state.history]);

  // Save reputations to localStorage
  useEffect(() => {
    localStorage.setItem('mirofish_reputations', JSON.stringify(agentReputations));
  }, [agentReputations]);

  // Autosave question draft
  useEffect(() => {
    if (state.question) {
      localStorage.setItem('mirofish_draft_question', state.question);
    } else {
      localStorage.removeItem('mirofish_draft_question');
    }
  }, [state.question]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (state.status === 'simulating') {
      scrollToBottom();
    }
  }, [state.messages]);

  const handleRegenerateAvatar = async (agentId: string) => {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return;

    setIsGeneratingAvatar(true);
    try {
      const newAvatar = await generateAvatar(agent.role, agent.name, customAvatarPrompt);
      const updatedAgents = state.agents.map(a => a.id === agentId ? { ...a, avatar: newAvatar } : a);
      
      setState(prev => ({
        ...prev,
        agents: updatedAgents
      }));

      // Sync to Firestore if in a session
      if (sessionId) {
        await updateDoc(doc(db, 'simulations', sessionId), {
          agents: updatedAgents,
          lastUpdated: Date.now()
        });
      }

      setCustomAvatarPrompt(''); // Reset prompt after generation
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  const handleSelectPremadeAvatar = (agentId: string, style: string) => {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return;

    const newAvatar = `https://api.dicebear.com/7.x/${style}/svg?seed=${agent.name}-${Date.now()}`;
    const updatedAgents = state.agents.map(a => a.id === agentId ? { ...a, avatar: newAvatar } : a);
    
    setState(prev => ({
      ...prev,
      agents: updatedAgents
    }));

    // Sync to Firestore if in a session
    if (sessionId) {
      updateDoc(doc(db, 'simulations', sessionId), {
        agents: updatedAgents,
        lastUpdated: Date.now()
      });
    }
  };

  const filteredHistory = state.history.filter(item => {
    const matchesQuery = item.question.toLowerCase().includes(historyFilters.query.toLowerCase());
    const matchesAgent = !historyFilters.agentRole || item.agents.some(a => a.role === historyFilters.agentRole);
    const matchesStartDate = !historyFilters.startDate || item.timestamp >= new Date(historyFilters.startDate).getTime();
    const matchesEndDate = !historyFilters.endDate || item.timestamp <= new Date(historyFilters.endDate).getTime() + 86400000;
    return matchesQuery && matchesAgent && matchesStartDate && matchesEndDate;
  });

  const allRoles = Array.from(new Set(state.history.flatMap(item => item.agents.map(a => a.role))));

  const t = TRANSLATIONS[state.language] || TRANSLATIONS.English;

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    const currentLang = LANGUAGES.find(l => l.value === state.language);
    recognition.lang = currentLang?.code || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setState(prev => ({ ...prev, question: transcript }));
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const exportToTxt = (question: string, agents: Agent[], messages: Message[], synthesis: string) => {
    const content = `
MIROFISH FORESIGHT REPORT
-------------------------
Date: ${new Date().toLocaleString()}
Inquiry: ${question}

DIGITAL SOCIETY (AGENTS):
${agents.map(a => `- ${a.name} (${a.role})`).join('\n')}

DEBATE TRANSCRIPT:
${messages.map(m => {
  const agent = agents.find(a => a.id === m.agentId);
  return `[${agent?.name}]: ${m.content}`;
}).join('\n\n')}

FINAL FORESIGHT:
${synthesis}

-------------------------
Generated by MiroFish Systems
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mirofish-foresight-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCheckout = async (plan: 'monthly' | 'annual' | 'one-time' = 'one-time') => {
    if (!user) return;
    setIsCheckingOut(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          plan: plan
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      if (error.message.includes('STRIPE_SECRET_KEY')) {
        setShowConfigError(true);
      } else {
        alert('Failed to start checkout. Please try again.');
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleStartSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.question.trim()) return;

    if (!user) {
      try {
        await signIn();
        return;
      } catch (error) {
        console.error("Sign in failed", error);
        return;
      }
    }

    let targetSessionId = sessionId;
    if (!targetSessionId || state.status === 'completed') {
      targetSessionId = Date.now().toString();
      setSessionId(targetSessionId);
      window.location.hash = targetSessionId;
    }

    const initialState: any = {
      question: state.question,
      language: state.language,
      status: 'initializing',
      agents: [],
      messages: [],
      timestamp: Date.now(),
      lastUpdated: Date.now(),
      createdBy: user.uid
    };

    const path = `simulations/${targetSessionId}`;
    try {
      await setDoc(doc(db, 'simulations', targetSessionId), initialState);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }

    setState(prev => ({ ...prev, status: 'initializing', agents: [], messages: [], synthesis: undefined }));

    try {
      const agents = await generateAgents(state.question, state.language, agentReputations);
      
      await updateDoc(doc(db, 'simulations', targetSessionId), {
        status: 'reviewing_agents',
        agents,
        lastUpdated: Date.now()
      });

      setState(prev => ({ ...prev, status: 'reviewing_agents', agents }));
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, status: 'error', error: 'The digital society encountered a disruption. Please try again.' }));
    }
  };

  const handleConfirmAgents = async () => {
    if (!sessionId || !user) return;
    
    setState(prev => ({ ...prev, status: 'simulating' }));
    
    try {
      await updateDoc(doc(db, 'simulations', sessionId), {
        status: 'simulating',
        agents: state.agents,
        lastUpdated: Date.now()
      });

      const { messages, reputationChanges, impactHeatmap } = await simulateDebate(state.question, state.agents, state.language);
      
      // Update reputations in state
      setAgentReputations(prev => {
        const next = { ...prev };
        state.agents.forEach(agent => {
          const change = reputationChanges[agent.id] || 0;
          next[agent.role] = (next[agent.role] || 100) + change;
        });
        return next;
      });

      // Update current agents with new reputations for synthesis and UI
      const updatedAgents = state.agents.map(a => ({
        ...a,
        reputation: a.reputation + (reputationChanges[a.id] || 0)
      }));

      // Update state.agents so UI shows new reputation
      setState(prev => ({ ...prev, agents: updatedAgents, impactHeatmap }));

      // Simulate typing/delay for each message and sync to Firestore
      let currentMessages: Message[] = [];
      for (let i = 0; i < messages.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        currentMessages = [...currentMessages, messages[i]];
        
        await updateDoc(doc(db, 'simulations', sessionId), {
          messages: currentMessages,
          lastUpdated: Date.now()
        });

        setState(prev => ({
          ...prev,
          messages: currentMessages
        }));
      }

      setState(prev => ({ ...prev, status: 'synthesizing' }));
      await updateDoc(doc(db, 'simulations', sessionId), {
        status: 'synthesizing',
        lastUpdated: Date.now()
      });

      const synthesis = await synthesizeForesight(state.question, currentMessages, updatedAgents, state.language);
      
      await updateDoc(doc(db, 'simulations', sessionId), {
        status: 'completed',
        synthesis,
        agents: updatedAgents,
        impactHeatmap,
        lastUpdated: Date.now()
      });

      const newHistoryItem: HistoryItem = {
        id: sessionId,
        question: state.question,
        agents: updatedAgents,
        messages: currentMessages,
        synthesis,
        impactHeatmap,
        timestamp: Date.now(),
      };

      setState(prev => ({ 
        ...prev, 
        status: 'completed', 
        synthesis,
        history: [newHistoryItem, ...prev.history].slice(0, 20) // Keep last 20
      }));

      // Auto Export
      exportToTxt(state.question, updatedAgents, currentMessages, synthesis);

    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, status: 'error', error: 'The digital society encountered a disruption. Please try again.' }));
    }
  };

  const handleValidate = async () => {
    if (!sessionId || !validationInput || !state.synthesis) return;
    
    setIsValidating(true);
    try {
      const { accuracyScore, validationReport } = await validateForesight(
        state.question, 
        state.synthesis, 
        validationInput, 
        state.language
      );

      const validation: ValidationData = {
        actualOutcome: validationInput,
        accuracyScore,
        validationReport,
        validatedAt: Date.now()
      };

      await updateDoc(doc(db, 'simulations', sessionId), {
        validation,
        lastUpdated: Date.now()
      });

      setState(prev => ({
        ...prev,
        validation,
        history: prev.history.map(item => item.id === sessionId ? { ...item, validation } : item)
      }));

      setIsValidationModalOpen(false);
      setValidationInput('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsValidating(false);
    }
  };

  const agentSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdateAgent = (id: string, updates: Partial<Agent>) => {
    const updatedAgents = state.agents.map(a => a.id === id ? { ...a, ...updates } : a);
    setState(prev => ({
      ...prev,
      agents: updatedAgents
    }));

    if (sessionId) {
      if (agentSyncTimeoutRef.current) {
        clearTimeout(agentSyncTimeoutRef.current);
      }
      agentSyncTimeoutRef.current = setTimeout(() => {
        updateDoc(doc(db, 'simulations', sessionId), {
          agents: updatedAgents,
          lastUpdated: Date.now()
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `simulations/${sessionId}`));
      }, 1000);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    setState(prev => ({
      ...prev,
      status: 'completed',
      question: item.question,
      agents: item.agents,
      messages: item.messages,
      synthesis: item.synthesis,
      impactHeatmap: item.impactHeatmap,
    }));
    setIsHistoryOpen(false);
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setState(prev => ({
      ...prev,
      history: prev.history.filter(item => item.id !== id)
    }));
  };

  const copyToClipboard = () => {
    if (state.synthesis) {
      navigator.clipboard.writeText(state.synthesis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const reset = () => {
    window.location.hash = '';
    setSessionId(null);
    setState(prev => ({
      ...prev,
      status: 'idle',
      question: '',
      agents: [],
      messages: [],
      synthesis: undefined,
    }));
  };

  const shareSession = () => {
    if (!sessionId) return;
    const url = `${window.location.origin}${window.location.pathname}#${sessionId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <div className="min-h-screen bg-[#0a0502] text-[#e0d8d0] font-sans selection:bg-[#ff4e00] selection:text-white overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#3a1510] rounded-full blur-[120px] opacity-30 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#ff4e00] rounded-full blur-[150px] opacity-10" />
      </div>

      {/* History Sidebar */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full md:max-w-sm bg-[#150d0a] border-l border-white/10 z-[101] shadow-2xl p-6 md:p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold uppercase tracking-widest flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#ff4e00]" /> {t.remembered}
                </h3>
                <button onClick={() => setIsHistoryOpen(false)} className="opacity-40 hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* Advanced Filters */}
              <div className="mb-6 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-40" />
                  <input 
                    type="text"
                    placeholder={t.searchKeywords}
                    value={historyFilters.query}
                    onChange={(e) => setHistoryFilters(prev => ({ ...prev, query: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#ff4e00]/50 transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest opacity-40 ml-1">{t.from}</label>
                    <input 
                      type="date"
                      value={historyFilters.startDate}
                      onChange={(e) => setHistoryFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:border-[#ff4e00]/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest opacity-40 ml-1">{t.to}</label>
                    <input 
                      type="date"
                      value={historyFilters.endDate}
                      onChange={(e) => setHistoryFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] focus:outline-none focus:border-[#ff4e00]/50 transition-all"
                    />
                  </div>
                </div>

                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-40" />
                  <select 
                    value={historyFilters.agentRole}
                    onChange={(e) => setHistoryFilters(prev => ({ ...prev, agentRole: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-[#ff4e00]/50 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-[#150d0a]">{t.allRoles}</option>
                    {allRoles.map(role => (
                      <option key={role} value={role} className="bg-[#150d0a]">{role}</option>
                    ))}
                  </select>
                </div>

                {(historyFilters.query || historyFilters.startDate || historyFilters.endDate || historyFilters.agentRole) && (
                  <button 
                    onClick={() => setHistoryFilters({ query: '', startDate: '', endDate: '', agentRole: '' })}
                    className="text-[9px] uppercase tracking-widest text-[#ff4e00] hover:underline w-full text-center"
                  >
                    {t.clearFilters}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-12 opacity-30 italic text-sm">
                    {state.history.length === 0 ? t.noHistory : t.noMatches}
                  </div>
                ) : (
                  filteredHistory.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className="bg-white/5 border border-white/5 p-4 rounded-2xl cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all group relative"
                    >
                      <div className="text-xs opacity-40 mb-2">{new Date(item.timestamp).toLocaleDateString()}</div>
                      <div className="text-sm font-medium line-clamp-2 italic font-serif">"{item.question}"</div>
                      <div className="flex -space-x-1.5 mt-3">
                        {item.agents.map((agent, i) => (
                          <div key={i} className="relative group/agent">
                            <img 
                              src={agent.avatar} 
                              alt={agent.name}
                              className="w-5 h-5 rounded-full border-2 border-[#150d0a] bg-white/10"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black text-[8px] rounded whitespace-nowrap opacity-0 group-hover/agent:opacity-100 transition-opacity z-10 pointer-events-none border border-white/10">
                              {agent.name} (Rep: {agent.reputation})
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Tooltip>
                          <TooltipTrigger 
                            onClick={(e) => {
                              e.stopPropagation();
                              exportToTxt(item.question, item.agents, item.messages, item.synthesis);
                            }}
                            className="p-1.5 bg-white/5 hover:bg-white/20 rounded-lg transition-colors"
                          >
                            <Download className="w-3 h-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Export this simulation to text</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger 
                            onClick={(e) => deleteHistoryItem(item.id, e)}
                            className="p-1.5 bg-white/5 hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete this simulation from history</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Avatar Customization Modal */}
      <AnimatePresence>
        {isCustomizingAgent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomizingAgent(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-[#1a1412] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold tracking-tight">{t.customizeAvatar}</h3>
                <button 
                  onClick={() => setIsCustomizingAgent(null)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
              </div>

              {state.agents.find(a => a.id === isCustomizingAgent) && (
                <div className="flex flex-col items-center gap-8">
                  <div 
                    className="w-32 h-32 rounded-full overflow-hidden border-4 shadow-2xl relative"
                    style={{ borderColor: state.agents.find(a => a.id === isCustomizingAgent)?.color }}
                  >
                    {isGeneratingAvatar ? (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <RefreshCcw className="w-8 h-8 animate-spin text-[#ff4e00]" />
                      </div>
                    ) : null}
                    <img 
                      src={state.agents.find(a => a.id === isCustomizingAgent)?.avatar} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="w-full space-y-6">
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-widest opacity-40">{t.customPrompt || 'Custom Style Prompt (Optional)'}</div>
                      <input
                        type="text"
                        value={customAvatarPrompt}
                        onChange={(e) => setCustomAvatarPrompt(e.target.value)}
                        placeholder="e.g. Cyberpunk, 8-bit, oil painting..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff4e00]/50 transition-all"
                      />
                    </div>

                    <button
                      onClick={() => handleRegenerateAvatar(isCustomizingAgent)}
                      disabled={isGeneratingAvatar}
                      className="w-full py-4 bg-[#ff4e00] text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#ff6a26] transition-all disabled:opacity-50"
                    >
                      <Sparkles className="w-5 h-5" />
                      {isGeneratingAvatar ? t.generatingAI : t.generateNewAI}
                    </button>

                    <div className="space-y-3">
                      <div className="text-xs uppercase tracking-widest opacity-40 text-center">{t.selectStyle}</div>
                      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {PREMADE_AVATAR_STYLES.map(style => (
                          <button
                            key={style.value}
                            onClick={() => handleSelectPremadeAvatar(isCustomizingAgent, style.value)}
                            className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] uppercase tracking-wider transition-colors"
                          >
                            {style.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 min-h-screen flex flex-col">
        {/* Config Error Modal */}
        {showConfigError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md w-full bg-[#1a1512] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Stripe Setup Required</h3>
              <p className="text-sm opacity-60 mb-6 leading-relaxed">
                To enable payments, you need to add your Stripe Secret Key to the environment variables in the **Settings** menu.
              </p>
              <div className="bg-white/5 rounded-xl p-4 mb-8 space-y-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold">
                  <span className="opacity-40">Variable Name</span>
                  <span className="text-[#ff4e00]">STRIPE_SECRET_KEY</span>
                </div>
                <div className="h-px bg-white/10" />
                <p className="text-[10px] opacity-40 leading-relaxed">
                  You can find this key in your Stripe Dashboard under Developers &gt; API Keys.
                </p>
              </div>
              <button 
                onClick={() => setShowConfigError(false)}
                className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all"
              >
                Dismiss
              </button>
            </motion.div>
          </div>
        )}

        {/* Header */}
        <header className="flex items-center justify-between mb-8 md:mb-16">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={reset}>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-[#ff4e00] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,78,0,0.4)] group-hover:scale-110 transition-transform">
              <Fish className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tighter uppercase italic">MiroFish</h1>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            {presence.length > 1 && (
              <div className="hidden md:flex items-center -space-x-2 mr-2">
                {presence.map((u, i) => (
                  <React.Fragment key={u.uid}>
                    <Tooltip>
                      <TooltipTrigger>
                        <div 
                          className="w-6 h-6 rounded-full border-2 border-[#0a0502] overflow-hidden bg-white/10 cursor-help"
                          style={{ zIndex: presence.length - i }}
                        >
                          <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{u.displayName}</p>
                      </TooltipContent>
                    </Tooltip>
                  </React.Fragment>
                ))}
                <div className="ml-4 text-[8px] uppercase tracking-widest text-[#ff4e00] font-bold animate-pulse">
                  Live
                </div>
              </div>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[10px] font-bold opacity-80">{user.displayName}</span>
                  <Tooltip>
                    <TooltipTrigger 
                      onClick={signOut} 
                      className="text-[8px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                    >
                      {t.signOut || 'Sign Out'}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>End your current session</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <img 
                      src={user.photoURL || ''} 
                      alt="User" 
                      className="w-8 h-8 rounded-full border border-white/10 cursor-help" 
                      referrerPolicy="no-referrer" 
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{user.displayName || 'User Profile'}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger 
                  onClick={signIn}
                  className="text-[10px] md:text-xs uppercase tracking-[0.2em] opacity-40 hover:opacity-100 flex items-center gap-2 transition-opacity"
                >
                  <Users className="w-4 h-4" /> {t.signIn || 'Sign In'}
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sign in to save and share simulations</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger 
                onClick={() => setIsHistoryOpen(true)}
                className="text-[10px] md:text-xs uppercase tracking-[0.2em] opacity-40 hover:opacity-100 flex items-center gap-2 transition-opacity"
              >
                <History className="w-4 h-4" /> <span className="hidden sm:inline">{t.history}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>View your previous foresight simulations</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger 
                onClick={() => setActiveTab(activeTab === 'simulation' ? 'dashboard' : 'simulation')}
                className={`text-[10px] md:text-xs uppercase tracking-[0.2em] flex items-center gap-2 transition-all px-3 py-1.5 rounded-full ${activeTab === 'dashboard' ? 'bg-[#ff4e00] text-white opacity-100' : 'opacity-40 hover:opacity-100'}`}
              >
                <BarChart2 className="w-4 h-4" /> <span className="hidden sm:inline">Dashboard</span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{activeTab === 'dashboard' ? 'Return to simulation' : 'View accuracy metrics and trends'}</p>
              </TooltipContent>
            </Tooltip>
            <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] opacity-40 font-mono hidden md:block">
              {state.status === 'idle' ? t.systemReady : `${t.status}: ${state.status}`}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1"
            >
              <div className="mb-12 text-center">
                <h2 className="text-4xl md:text-6xl font-light tracking-tight mb-4 italic">Accuracy Dashboard</h2>
                <p className="opacity-40 uppercase tracking-[0.3em] text-xs">Benchmarking Foresight against Reality</p>
              </div>
              <AccuracyDashboard history={state.history} />
            </motion.div>
          ) : (
            <React.Fragment key="simulation">
              {state.status === 'idle' && !sessionId && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex-1 flex flex-col justify-center items-center text-center"
                >
                  <h2 className="text-4xl md:text-7xl font-light leading-tight mb-6 md:mb-8 tracking-tight">
                {t.heroTitle}
              </h2>
              <p className="max-w-xl text-base md:text-lg opacity-60 mb-8 md:mb-12 leading-relaxed px-4">
                {t.heroSubtitle}
              </p>

                <div className="w-full max-w-2xl flex flex-col gap-4 px-4">
                  <div className="flex items-center justify-center gap-4 mb-2">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2">
                      <Globe className="w-4 h-4 text-[#ff4e00]" />
                      <select 
                        value={state.language}
                        onChange={(e) => setState(prev => ({ ...prev, language: e.target.value }))}
                        className="bg-transparent text-[10px] md:text-xs uppercase tracking-widest font-bold focus:outline-none cursor-pointer"
                      >
                        {LANGUAGES.map(lang => (
                          <option key={lang.value} value={lang.value} className="bg-[#150d0a]">{lang.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <form onSubmit={handleStartSimulation} className="relative group">
                    <input
                      type="text"
                      value={state.question}
                      onChange={(e) => setState(prev => ({ ...prev, question: e.target.value }))}
                      placeholder={isListening ? t.listening : t.placeholder}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 md:px-8 py-5 md:py-6 text-lg md:text-xl focus:outline-none focus:border-[#ff4e00]/50 focus:bg-white/10 transition-all pr-28 md:pr-36 shadow-2xl backdrop-blur-xl"
                    />
                    <div className="absolute right-2 top-2 bottom-2 flex gap-2">
                      <Tooltip>
                        <TooltipTrigger 
                          type="button"
                          onClick={toggleListening}
                          className={`px-3 md:px-4 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                        >
                          {isListening ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{isListening ? 'Stop listening' : 'Use voice input'}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger 
                          type="submit"
                          disabled={!state.question.trim()}
                          className="px-4 md:px-6 bg-[#ff4e00] text-white rounded-xl flex items-center justify-center hover:bg-[#ff6a26] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Begin the digital society simulation</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </form>
                </div>
              
              <div className="mt-12 flex flex-wrap justify-center gap-4 md:gap-8 text-[10px] md:text-xs uppercase tracking-widest opacity-30">
                <div className="flex items-center gap-2"><Users className="w-4 h-4" /> {t.analysts}</div>
                <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> {t.marketSynthesis}</div>
                <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> {t.aiForesight}</div>
              </div>
            </motion.div>
          )}

          {state.status === 'idle' && sessionId && !user && (
            <motion.div
              key="auth-required"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex-1 flex flex-col justify-center items-center text-center"
            >
              <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-8 border border-white/10">
                <Users className="w-10 h-10 text-[#ff4e00]" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Collaboration Required</h2>
              <p className="max-w-md opacity-60 mb-8">
                You've been invited to a MiroFish foresight session. Please sign in to join the digital society.
              </p>
              <button
                onClick={signIn}
                className="px-8 py-4 bg-[#ff4e00] text-white rounded-2xl font-bold hover:bg-[#ff6a26] transition-all flex items-center gap-3 shadow-2xl"
              >
                <Users className="w-5 h-5" />
                Sign In with Google
              </button>
            </motion.div>
          )}

          {state.status === 'idle' && sessionId && user && (
            <motion.div
              key="loading-session"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col justify-center items-center"
            >
              <RefreshCcw className="w-12 h-12 animate-spin text-[#ff4e00] mb-4" />
              <p className="opacity-40 uppercase tracking-widest text-xs">Joining Session...</p>
            </motion.div>
          )}

          {state.status === 'initializing' && (
            <motion.div
              key="initializing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col justify-center items-center text-center"
            >
              <div className="relative w-32 h-32 mb-8">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-t-2 border-r-2 border-[#ff4e00] rounded-full"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-4 border-b-2 border-l-2 border-[#ff4e00]/30 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Users className="w-10 h-10 text-[#ff4e00] animate-pulse" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2 uppercase tracking-widest italic">Assembling Digital Society</h2>
              <p className="opacity-40 text-xs uppercase tracking-[0.3em]">Identifying expert personas for your inquiry...</p>
            </motion.div>
          )}

          {state.status === 'reviewing_agents' && (
            <motion.div
              key="reviewing-agents"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col gap-8"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-5xl font-light mb-4 tracking-tight">The Digital Society</h2>
                <p className="opacity-60 max-w-xl mx-auto">
                  Gemini has identified these expert personas to debate your inquiry. Customize their backgrounds to refine the simulation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.agents.map((agent) => (
                  <motion.div
                    key={agent.id}
                    layoutId={agent.id}
                    className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md flex flex-col gap-4 group hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Tooltip>
                          <TooltipTrigger>
                            <img src={agent.avatar} alt={agent.name} className="w-16 h-16 rounded-2xl border-2 cursor-help" style={{ borderColor: agent.color }} referrerPolicy="no-referrer" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Digital persona avatar</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-lg cursor-help" style={{ backgroundColor: agent.color }}>
                              {agent.reputation}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Agent reputation score</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex-1">
                        <input 
                          value={agent.name}
                          onFocus={() => setEditingAgentId(agent.id)}
                          onBlur={() => setEditingAgentId(null)}
                          onChange={(e) => handleUpdateAgent(agent.id, { name: e.target.value })}
                          className="w-full bg-transparent font-bold text-lg focus:outline-none border-b border-transparent focus:border-[#ff4e00]/50"
                        />
                        <input 
                          value={agent.role}
                          onFocus={() => setEditingAgentId(agent.id)}
                          onBlur={() => setEditingAgentId(null)}
                          onChange={(e) => handleUpdateAgent(agent.id, { role: e.target.value })}
                          className="w-full bg-transparent text-xs opacity-60 uppercase tracking-widest focus:outline-none border-b border-transparent focus:border-[#ff4e00]/50"
                        />
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-widest opacity-40">{agent.demographics.ageRange}</span>
                          <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-widest opacity-40">{agent.demographics.segment}</span>
                        </div>
                      </div>
                    </div>
                    <textarea 
                      value={agent.background}
                      onFocus={() => setEditingAgentId(agent.id)}
                      onBlur={() => setEditingAgentId(null)}
                      onChange={(e) => handleUpdateAgent(agent.id, { background: e.target.value })}
                      className="flex-1 bg-white/5 rounded-xl p-3 text-xs leading-relaxed opacity-80 focus:outline-none focus:bg-white/10 transition-all resize-none h-24"
                      placeholder="Agent background and personality..."
                    />
                    <Tooltip>
                      <TooltipTrigger 
                        onClick={() => setIsCustomizingAgent(agent.id)}
                        className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center gap-1 transition-opacity self-end"
                      >
                        <Sparkles className="w-3 h-3" /> Regenerate Avatar
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Customize or regenerate this agent's appearance</p>
                      </TooltipContent>
                    </Tooltip>
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-center mt-8">
                <Tooltip>
                  <TooltipTrigger 
                    onClick={handleConfirmAgents}
                    className="px-12 py-5 bg-[#ff4e00] text-white rounded-2xl font-bold hover:bg-[#ff6a26] transition-all flex items-center gap-3 shadow-2xl group"
                  >
                    <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    Initiate Foresight Debate
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Start the AI-driven debate between these personas</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </motion.div>
          )}

          {(state.status === 'simulating' || state.status === 'synthesizing' || state.status === 'completed') && (
            <motion.div
              key="simulation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col gap-8"
            >
              {/* Simulation Header */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-widest text-[#ff4e00] font-bold">{t.inquiry}</span>
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full opacity-60">{state.language}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Tooltip>
                      <TooltipTrigger 
                        onClick={shareSession} 
                        className="text-xs opacity-40 hover:opacity-100 flex items-center gap-1 transition-opacity"
                      >
                        <Share2 className="w-3 h-3" /> {copied ? t.copied : t.share}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Share this simulation session via URL</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger 
                        onClick={reset} 
                        className="text-xs opacity-40 hover:opacity-100 flex items-center gap-1 transition-opacity"
                      >
                        <RefreshCcw className="w-3 h-3" /> {t.newInquiry}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Start a new foresight simulation</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-medium italic font-serif">"{state.question}"</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
                {/* Agents List */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                  <h4 className="text-xs uppercase tracking-widest opacity-40 mb-2">{t.digitalSociety}</h4>
                  {state.agents.length === 0 ? (
                    <div className="flex flex-col gap-4">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    state.agents.map((agent) => (
                      <motion.div
                        key={agent.id}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-4 group hover:bg-white/10 transition-colors"
                      >
                        <div 
                          className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden border-2 cursor-pointer hover:scale-110 transition-transform relative group/avatar"
                          style={{ borderColor: agent.color }}
                          onClick={() => setIsCustomizingAgent(agent.id)}
                        >
                          <img src={agent.avatar} alt={agent.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-sm truncate">{agent.name}</div>
                            <div className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded-md opacity-60 flex items-center gap-1">
                              <TrendingUp className="w-2 h-2" /> {agent.reputation}
                            </div>
                          </div>
                          <div className="text-[10px] uppercase tracking-wider opacity-40 truncate">{agent.role}</div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger 
                            onClick={() => setIsCustomizingAgent(agent.id)}
                            className="p-1.5 opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity"
                          >
                            <Sparkles className="w-3 h-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Customize Avatar</p>
                          </TooltipContent>
                        </Tooltip>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Debate Feed */}
                <div className="lg:col-span-2 flex flex-col gap-4 bg-white/[0.02] border border-white/5 rounded-3xl p-4 md:p-6 h-[400px] md:h-[500px] overflow-y-auto scrollbar-hide relative">
                  <h4 className="text-[10px] md:text-xs uppercase tracking-widest opacity-40 mb-2 sticky top-0 bg-[#0a0502]/80 backdrop-blur-sm py-2 z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span>{t.liveSynthesis}</span>
                    {state.status === 'completed' && (
                      <div className="flex gap-4">
                        <Tooltip>
                          <TooltipTrigger 
                            onClick={() => exportToTxt(state.question, state.agents, state.messages, state.synthesis || '')}
                            className="flex items-center gap-2 hover:text-[#ff4e00] transition-colors"
                          >
                            <Download className="w-3 h-3" /> <span className="hidden sm:inline">{t.exportTxt}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Download the simulation report as a text file</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger 
                            onClick={copyToClipboard}
                            className="flex items-center gap-2 hover:text-[#ff4e00] transition-colors"
                          >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? t.copied : <span className="hidden sm:inline">{t.copyDebate}</span>}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Copy the synthesis to your clipboard</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </h4>
                  
                  <div className="flex flex-col gap-6">
                    {state.messages.map((msg, idx) => {
                      const agent = state.agents.find(a => a.id === msg.agentId);
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex gap-4"
                        >
                          <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden mt-1">
                            <img src={agent?.avatar} alt={agent?.name} referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold" style={{ color: agent?.color }}>{agent?.name}</span>
                              <span className="text-[10px] opacity-20">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                            <p className="text-sm leading-relaxed opacity-80">{msg.content}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                    
                    {state.status === 'simulating' && state.messages.length < state.agents.length && (
                      <div className="flex gap-4 animate-pulse">
                        <div className="w-8 h-8 bg-white/10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-white/10 rounded w-24" />
                          <div className="h-3 bg-white/10 rounded w-full" />
                        </div>
                      </div>
                    )}

                    {state.status === 'synthesizing' && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-12 text-center gap-4"
                      >
                        <div className="w-12 h-12 border-2 border-[#ff4e00] border-t-transparent rounded-full animate-spin" />
                        <div className="text-sm italic font-serif opacity-60">{t.synthesizing}</div>
                      </motion.div>
                    )}

                    {state.status === 'completed' && state.impactHeatmap && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8"
                      >
                        <SocietalHeatmap points={state.impactHeatmap} agents={state.agents} />
                      </motion.div>
                    )}

                    {state.status === 'completed' && state.synthesis && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-8 bg-[#ff4e00] text-white p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden group"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:rotate-12 transition-transform">
                          <Sparkles className="w-8 h-8 md:w-12 md:h-12" />
                        </div>
                        <div className="flex justify-between items-start mb-4">
                          <h5 className="text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold opacity-80">{t.finalForesight}</h5>
                          <div className="flex gap-2">
                            {state.validation ? (
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest cursor-help">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {state.validation.accuracyScore}% Accuracy
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Accuracy score based on real-world validation</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger 
                                  onClick={() => setIsValidationModalOpen(true)}
                                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors"
                                >
                                  <Target className="w-3 h-3" />
                                  Benchmark
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Validate this foresight against actual real-world outcomes</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger 
                                onClick={() => exportToTxt(state.question, state.agents, state.messages, state.synthesis || '')}
                                className="p-2 bg-black/20 hover:bg-black/40 rounded-lg transition-colors"
                              >
                                <Download className="w-4 h-4" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Download foresight report</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger 
                                onClick={copyToClipboard}
                                className="p-2 bg-black/20 hover:bg-black/40 rounded-lg transition-colors"
                              >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Copy synthesis text</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="text-lg md:text-2xl font-serif italic leading-snug">
                          {state.synthesis}
                        </div>
                        <Tooltip>
                          <TooltipTrigger 
                            onClick={reset}
                            className="mt-8 flex items-center gap-2 text-[10px] md:text-xs uppercase tracking-widest font-bold bg-black/20 hover:bg-black/40 px-4 py-2 rounded-full transition-colors"
                          >
                            {t.newSimulation} <ChevronRight className="w-4 h-4" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Clear current results and start over</p>
                          </TooltipContent>
                        </Tooltip>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {state.status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-4">{t.simulationDisrupted}</h3>
              <p className="opacity-60 mb-8 max-w-md">{state.error}</p>
              <button
                onClick={reset}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors uppercase tracking-widest text-xs font-bold"
              >
                {t.tryAgain}
              </button>
            </motion.div>
          )}
        </React.Fragment>
      )}
    </AnimatePresence>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] uppercase tracking-widest opacity-30 font-mono">
          <div>&copy; 2026 MiroFish Systems</div>
          <div className="flex gap-6">
            <a href="#" className="hover:opacity-100 transition-opacity">{t.protocol}</a>
            <a href="#" className="hover:opacity-100 transition-opacity">{t.neuralGrid}</a>
            <a href="#" className="hover:opacity-100 transition-opacity">{t.privacy}</a>
          </div>
        </footer>
        {/* Validation Modal */}
        <AnimatePresence>
          {isValidationModalOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="max-w-lg w-full bg-[#1a1512] border border-white/10 rounded-3xl p-8 shadow-2xl"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-[#ff4e00]/20 rounded-2xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-[#ff4e00]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold italic">Benchmark Foresight</h3>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest">Validate AI predictions against reality</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-2 block">Actual Real-World Outcome</label>
                    <textarea 
                      value={validationInput}
                      onChange={(e) => setValidationInput(e.target.value)}
                      placeholder="Describe what actually happened in the real world..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-[#ff4e00]/50 min-h-[120px] resize-none"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setIsValidationModalOpen(false)}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all text-xs uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleValidate}
                      disabled={isValidating || !validationInput}
                      className="flex-1 py-4 bg-[#ff4e00] hover:bg-[#ff6a26] disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      {isValidating ? (
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>Validate Outcome</>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
    </TooltipProvider>
    </ErrorBoundary>
  );
}
