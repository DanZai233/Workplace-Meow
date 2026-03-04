import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { GoogleGenAI } from '@google/genai';
import { PERSONAS, QUICK_TOOLS, Message, PetState, Persona } from './constants';
import { Live2DPet } from './components/Live2DPet';
import { AIService, AIConfig } from './lib/ai-providers';
import { Send, Menu, X, User, Sparkles, Briefcase, Settings, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

const currentWindow = getCurrentWebviewWindow();

let aiService: AIService | null = null;

export default function App() {
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [petState, setPetState] = useState<PetState>('idle');
  const [petBubble, setPetBubble] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [clickThrough, setClickThrough] = useState(true);
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-pro',
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize AI service when config changes
  useEffect(() => {
    if (aiConfig.apiKey) {
      aiService = new AIService(aiConfig);
    }
  }, [aiConfig]);

  const loadSettings = async () => {
    try {
      const settings = await invoke<Record<string, any>>('get_settings');
      
      if (settings.ai_provider) {
        setAiConfig(prev => ({ ...prev, provider: settings.ai_provider }));
      }
      if (settings.api_key) {
        setAiConfig(prev => ({ ...prev, apiKey: settings.api_key }));
      }
      if (settings.model_name) {
        setAiConfig(prev => ({ ...prev, model: settings.model_name }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isGenerating) return;
    
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text }]);
    setInput('');
    setPetState('typing');
    setPetBubble('');
    setIsGenerating(true);

    try {
      const modelMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '' }]);
      
      let fullText = '';
      const chatMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.text
      }));
      chatMessages.push({ role: 'user', content: text });

      if (aiService) {
        for await (const chunk of aiService.sendMessageStream(chatMessages, activePersona.prompt)) {
          fullText += chunk;
          setMessages(prev => prev.map(msg => 
            msg.id === modelMsgId ? { ...msg, text: fullText } : msg
          ));
          
          const words = fullText.split(/[,.!?，。！？\n]/).filter(Boolean);
          if (words.length > 0) {
            const lastPhrase = words[words.length - 1].trim();
            if (lastPhrase) {
              setPetBubble(lastPhrase.substring(0, 12) + (lastPhrase.length > 12 ? '...' : ''));
            }
          }
        }
      } else {
        throw new Error('AI service not initialized');
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

  const handlePetDoubleClick = () => {
    setShowChat(!showChat);
    invoke('toggle_window', { label: 'chat', visible: !showChat });
  };

  const handleOpenSettings = () => {
    invoke('toggle_window', { label: 'settings', visible: true });
  };

  const handleMouseMove = async (e: MouseEvent) => {
    if (!clickThrough) return;
    
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      await invoke('set_click_through', { enabled: false });
      setClickThrough(false);
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [clickThrough]);

  return (
    <div className="h-screen bg-transparent font-sans overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Live2DPet 
          state={petState} 
          onDoubleClick={handlePetDoubleClick}
        />
      </div>

      <AnimatePresence>
        {petBubble && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            className="absolute bottom-32 right-12 z-50 bg-white text-slate-800 px-4 py-3 rounded-2xl shadow-xl border border-slate-200 max-w-[280px] text-sm font-medium pointer-events-auto"
          >
            {petBubble}
            <div className="absolute top-full right-8 border-8 border-transparent border-t-white drop-shadow-sm"></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setShowChat(!showChat)}
          className="p-3 bg-white rounded-xl shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          title="打开聊天"
        >
          <MessageSquare className="w-5 h-5 text-slate-700" />
        </button>
        <button
          onClick={handleOpenSettings}
          className="p-3 bg-white rounded-xl shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          title="设置"
        >
          <Settings className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 right-4 z-50 w-96 max-h-[80vh] flex flex-col"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{activePersona.icon}</span>
                  <span className="font-semibold text-white">{activePersona.name}</span>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="p-1 hover:bg-white/20 rounded-md transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              <div className="p-4 space-y-2 overflow-y-auto max-h-[50vh]">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-sm'
                    }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : activePersona.icon}
                    </div>
                    <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
                      <div className={`px-3 py-2 rounded-xl text-sm ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {msg.role === 'user' ? (
                          <div className="whitespace-pre-wrap">{msg.text}</div>
                        ) : (
                          <div className="prose prose-sm prose-slate">
                            {msg.text ? <ReactMarkdown>{msg.text}</ReactMarkdown> : <span className="animate-pulse">...</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-slate-200">
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(input);
                      }
                    }}
                    placeholder={`和${activePersona.name}聊聊...`}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 resize-none text-sm"
                    rows={2}
                  />
                  <button
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || isGenerating}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors self-end"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
