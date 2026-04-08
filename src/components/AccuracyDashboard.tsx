import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { HistoryItem } from '../types';
import { motion } from 'motion/react';
import { TrendingUp, Target, AlertCircle, Calendar, Info } from 'lucide-react';
import {
  Tooltip as ShadcnTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AccuracyDashboardProps {
  history: HistoryItem[];
}

export const AccuracyDashboard: React.FC<AccuracyDashboardProps> = ({ history }) => {
  const validatedItems = history.filter(item => item.validation).sort((a, b) => a.timestamp - b.timestamp);
  
  if (validatedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10">
          <Target className="w-10 h-10 text-[#ff4e00] opacity-40" />
        </div>
        <div>
          <h3 className="text-2xl font-bold mb-2">No Validation Data Yet</h3>
          <p className="max-w-md opacity-40 text-sm">
            Start benchmarking your simulations against real-world outcomes to see accuracy metrics here.
          </p>
        </div>
      </div>
    );
  }

  const averageAccuracy = validatedItems.reduce((acc, item) => acc + (item.validation?.accuracyScore || 0), 0) / validatedItems.length;
  
  const lineData = validatedItems.map(item => ({
    date: new Date(item.timestamp).toLocaleDateString(),
    accuracy: item.validation?.accuracyScore,
    question: item.question.slice(0, 30) + '...'
  }));

  const accuracyRanges = [
    { name: 'Low (0-40)', count: validatedItems.filter(i => (i.validation?.accuracyScore || 0) <= 40).length, color: '#ef4444' },
    { name: 'Mid (41-75)', count: validatedItems.filter(i => (i.validation?.accuracyScore || 0) > 40 && (i.validation?.accuracyScore || 0) <= 75).length, color: '#f59e0b' },
    { name: 'High (76-100)', count: validatedItems.filter(i => (i.validation?.accuracyScore || 0) > 75).length, color: '#22c55e' },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ShadcnTooltip>
          <TooltipTrigger>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl cursor-help"
            >
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-5 h-5 text-[#ff4e00]" />
                <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">Avg Accuracy</span>
              </div>
              <div className="text-4xl font-bold italic">{averageAccuracy.toFixed(1)}%</div>
              <p className="text-[10px] opacity-40 mt-2 uppercase tracking-widest">Across {validatedItems.length} Validations</p>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>The mean accuracy score of all validated simulations</p>
          </TooltipContent>
        </ShadcnTooltip>

        <ShadcnTooltip>
          <TooltipTrigger>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl cursor-help"
            >
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">Trend</span>
              </div>
              <div className="text-4xl font-bold italic">
                {validatedItems.length > 1 
                  ? (validatedItems[validatedItems.length-1].validation!.accuracyScore - validatedItems[0].validation!.accuracyScore >= 0 ? '+' : '') + 
                    (validatedItems[validatedItems.length-1].validation!.accuracyScore - validatedItems[0].validation!.accuracyScore).toFixed(0) + '%'
                  : 'N/A'}
              </div>
              <p className="text-[10px] opacity-40 mt-2 uppercase tracking-widest">First vs Latest</p>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Change in accuracy from the first validation to the most recent</p>
          </TooltipContent>
        </ShadcnTooltip>

        <ShadcnTooltip>
          <TooltipTrigger>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl cursor-help"
            >
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-5 h-5 text-blue-500" />
                <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">Last Validated</span>
              </div>
              <div className="text-xl font-bold italic truncate">
                {new Date(validatedItems[validatedItems.length-1].validation!.validatedAt).toLocaleDateString()}
              </div>
              <p className="text-[10px] opacity-40 mt-2 uppercase tracking-widest">Most Recent Benchmark</p>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>The date of the most recently performed benchmark</p>
          </TooltipContent>
        </ShadcnTooltip>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
          <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-[#ff4e00] mb-8">Accuracy Over Time</h4>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1a1512', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#ff4e00' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#ff4e00" 
                  strokeWidth={3} 
                  dot={{ r: 6, fill: '#ff4e00', strokeWidth: 2, stroke: '#1a1512' }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
          <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-[#ff4e00] mb-8">Distribution</h4>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accuracyRanges}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1a1512', border: '1px solid #ffffff10', borderRadius: '12px' }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {accuracyRanges.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Validations List */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h4 className="text-xs font-bold uppercase tracking-[0.3em] text-[#ff4e00]">Historical Benchmarks</h4>
        </div>
        <div className="divide-y divide-white/5">
          {validatedItems.slice().reverse().map((item) => (
            <div key={item.id} className="p-6 hover:bg-white/5 transition-colors group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#ff4e00]">{item.validation?.accuracyScore}% Accuracy</span>
                    <span className="text-[10px] opacity-20 uppercase tracking-widest">{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                  <h5 className="text-sm font-bold italic mb-1">"{item.question}"</h5>
                  <p className="text-xs opacity-60 line-clamp-2 italic font-serif">
                    {item.validation?.validationReport}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <div className="text-[8px] uppercase tracking-widest opacity-40 mb-1">Actual Outcome</div>
                    <div className="text-[10px] font-bold max-w-[200px] truncate">{item.validation?.actualOutcome}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
