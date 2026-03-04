import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { PERSONAS, QUICK_TOOLS, Message, PetState, Persona } from './constants';
import { BongoCat } from './components/BongoCat';
import { Send, Menu, X, User, Sparkles, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [petState, setPetState] = useState<PetState>('idle');
  const [petBubble, setPetBubble] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize chat session when persona changes
  useEffect(() => {
    const session = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: activePersona.prompt,
      }
    });
    setChatSession(session);
    setMessages([{ 
      id: Date.now().toString(), 
      role: 'model', 
      text: `你好！我是你的${activePersona.name}。今天工作上有什么我可以帮你的吗？` 
    }]);
    setPetBubble(`我是${activePersona.name}喵~`);
    setTimeout(() => setPetBubble(''), 3000);
  }, [activePersona]);

  const handleSend = async (text: string) => {
    if (!text.trim() || !chatSession || isGenerating) return;
    
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text }]);
    setInput('');
    setPetState('typing');
    setPetBubble('');
    setIsGenerating(true);

    try {
      const responseStream = await chatSession.sendMessageStream({ message: text });
      
      const modelMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '' }]);
      
      let fullText = '';
      for await (const chunk of responseStream) {
        const chunkText = chunk.text || '';
        fullText += chunkText;
        setMessages(prev => prev.map(msg => 
          msg.id === modelMsgId ? { ...msg, text: fullText } : msg
        ));
        
        // Update pet bubble with the latest few words
        const words = fullText.split(/[,.!?，。！？\n]/).filter(Boolean);
        if (words.length > 0) {
          const lastPhrase = words[words.length - 1].trim();
          if (lastPhrase) {
            setPetBubble(lastPhrase.substring(0, 12) + (lastPhrase.length > 12 ? '...' : ''));
          }
        }
      }
      setPetState('idle');
      setPetBubble('搞定喵！');
      setTimeout(() => setPetBubble(''), 3000);
    } catch (error) {
      console.error(error);
      setPetState('idle');
      setPetBubble('出错了喵...');
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: '抱歉，我遇到了一点问题，请稍后再试。' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-white border-r border-slate-200 flex flex-col h-full z-20 shrink-0 shadow-sm overflow-hidden"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                <span className="whitespace-nowrap">职场喵助手</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-slate-100 rounded-md lg:hidden">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Personas */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">选择职场搭档</h3>
                <div className="space-y-2">
                  {PERSONAS.map(persona => (
                    <button
                      key={persona.id}
                      onClick={() => setActivePersona(persona)}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        activePersona.id === persona.id 
                          ? 'bg-indigo-50 border border-indigo-100 shadow-sm' 
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{persona.icon}</div>
                        <div>
                          <div className={`font-medium ${activePersona.id === persona.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                            {persona.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                            {persona.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Tools */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">快捷指令</h3>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_TOOLS.map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setInput(tool.prompt);
                        setPetState('thinking');
                      }}
                      className="flex items-center gap-1.5 p-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{tool.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 shrink-0 shadow-sm z-10">
          {!isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-md mr-2">
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xl">{activePersona.icon}</span>
            <h2 className="font-semibold text-slate-800">{activePersona.name}</h2>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-32">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-xl'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : activePersona.icon}
              </div>
              <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 rounded-2xl max-w-[85%] sm:max-w-[75%] ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                }`}>
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap text-sm">{msg.text}</div>
                  ) : (
                    <div className="markdown-body">
                      {msg.text ? <ReactMarkdown>{msg.text}</ReactMarkdown> : <span className="animate-pulse">...</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-6 pb-4 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto relative">
            <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder={`和${activePersona.name}聊聊工作上的事... (Shift+Enter 换行)`}
                className="w-full max-h-32 min-h-[56px] py-3 pl-4 pr-12 bg-transparent border-none focus:outline-none resize-none text-sm text-slate-800 placeholder-slate-400"
                rows={1}
              />
              <button
                onClick={() => handleSend(input)}
                disabled={!input.trim() || isGenerating}
                className="absolute right-2 bottom-2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Pet Widget */}
        <div className="absolute bottom-24 right-8 z-30 pointer-events-none hidden sm:block">
          <div className="relative">
            <AnimatePresence>
              {petBubble && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.8 }}
                  className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-white text-slate-800 px-4 py-2 rounded-2xl shadow-lg border border-slate-200 max-w-[200px] text-sm font-medium whitespace-nowrap"
                >
                  {petBubble}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white drop-shadow-sm"></div>
                </motion.div>
              )}
            </AnimatePresence>
            <BongoCat state={petState} />
          </div>
        </div>
      </div>
    </div>
  );
}
