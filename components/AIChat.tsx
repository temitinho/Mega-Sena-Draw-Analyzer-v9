
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Send, Bot, User, Sparkles, Trash2, Zap, MessageSquareQuote, Loader2 } from 'lucide-react';
import { Draw } from '../types.ts';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AIChatProps {
  draws: Draw[];
  heatmapData: Float32Array;
  onClose?: () => void;
}

const AIChat: React.FC<AIChatProps> = ({ draws, heatmapData }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "I have indexed the historical probability maps. You can ask me about specific weights, historical anomalies, or ball-weight correlations. How can I assist your strategy today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const prepareContext = () => {
    // We send a summarized history to stay within token limits while providing deep context
    // Focus on the last 50 draws with their specific weights
    const contextDraws = draws.slice(-50).map((draw, tIdx) => {
      const realIdx = (draws.length - 50) + tIdx;
      const ballsWithWeights = draw.balls.map(ball => {
        const prob = heatmapData[realIdx * 60 + (ball - 1)];
        return `Ball ${ball} (Weight: ${prob.toFixed(3)}%)`;
      });
      return `Draw #${draw.id}: ${ballsWithWeights.join(', ')}`;
    });

    return `
      System: You are an AI Lottery Analyst for Mega-Sena.
      You have access to the last 50 draws and the specific probability weight (calculated by our algorithm) each ball had at the moment it was drawn.
      
      Historical Context (Last 50 Draws):
      ${contextDraws.join('\n')}
      
      Instructions:
      - Answer user questions based strictly on this data.
      - If a user asks about a specific probability (e.g., 7%), scan the data to see if any ball was drawn near that weight.
      - Be concise, technical, and professional.
      - If data is not in the last 50 draws, specify that you are looking at the recent history index.
    `;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: (process.env.API_KEY as string) });
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: prepareContext(),
        }
      });

      const response = await chat.sendMessageStream({ message: userMsg });
      
      let fullText = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      for await (const chunk of response) {
        fullText += chunk.text;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].text = fullText;
          return newMsgs;
        });
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Error connecting to Intelligence Layer. Please check your API configuration." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 rounded-[2rem] overflow-hidden border border-gray-800 shadow-2xl relative">
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
      
      {/* Chat Header */}
      <div className="p-6 border-b border-gray-800 bg-gray-900/50 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-widest leading-none">AI Data Consultant</h4>
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mt-1 block">Contextual Analysis Active</span>
          </div>
        </div>
        <button 
          onClick={() => setMessages([{ role: 'model', text: 'Chat history cleared. Intelligence layer reset.' }])}
          className="p-2 text-gray-500 hover:text-white transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide z-10"
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-gray-800 border border-gray-700'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-indigo-400" />}
              </div>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed font-medium ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-gray-900 text-gray-200 border border-gray-800 rounded-tl-none shadow-xl'
              }`}>
                {msg.text || (loading && i === messages.length - 1 ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : '')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Prompts */}
      {messages.length < 3 && (
        <div className="p-4 flex gap-2 overflow-x-auto scrollbar-hide z-10 border-t border-gray-800 bg-gray-900/20">
          <button 
            onClick={() => { setInput("Which ball was drawn with the lowest probability?"); }}
            className="flex-shrink-0 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-700 transition-all active:scale-95"
          >
            Lowest Weight Hit
          </button>
          <button 
            onClick={() => { setInput("Summarize the correlation between high weight and winning balls."); }}
            className="flex-shrink-0 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-700 transition-all active:scale-95"
          >
            Weight Correlation
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-6 bg-gray-900/80 backdrop-blur-xl border-t border-gray-800 z-10">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Interrogate the data layer..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all placeholder:text-gray-500 text-sm font-medium"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-2 p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:opacity-50 text-white rounded-xl transition-all shadow-lg active:scale-90"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-[0.3em] text-gray-600">
          <Zap className="w-3 h-3" /> Powered by Gemini Flash Intelligence
        </div>
      </div>
    </div>
  );
};

export default AIChat;
