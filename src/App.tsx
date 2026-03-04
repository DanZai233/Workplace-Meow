import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { GoogleGenAI } from '@google/genai';
import { PERSONAS, QUICK_TOOLS, Message, PetState, Persona } from './constants';
import { Live2DPetWithBoundary } from './components/Live2DPet';
import { DebugOverlay } from './components/DebugOverlay';
import { debugLog } from './utils/debug-log';
import { useModel } from './hooks/useModel';
import { AIService, AIConfig } from './lib/ai-providers';
import { Send, Menu, X, User, Sparkles, Briefcase, Settings, MessageSquare, MoreVertical, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

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
  const [dragEnabled, setDragEnabled] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ winX: number; winY: number; mouseX: number; mouseY: number } | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-pro',
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentModel } = useModel();
  const [settingsModelPath, setSettingsModelPath] = useState<string | null>(null);
  // 优先使用设置里保存的模型路径，否则用当前选中的预设路径，否则默认 elsia（避免启动时先显示 SVG 猫）；Live2DPet 内会解析名称
  const rawModelPath =
    (settingsModelPath && String(settingsModelPath).trim()) ||
    (currentModel?.path && currentModel.id !== 'custom' ? currentModel.path : undefined) ||
    'elsia';

  // 启动时写一条调试信息，便于在控制台/调试栏确认页面已加载
  useEffect(() => {
    debugLog.add('info', '主窗口 App 已挂载');
  }, []);

  // Load settings on mount and when settings window saves
  useEffect(() => {
    loadSettings();
    const unlisten = listen('settings-saved', () => {
      loadSettings();
    });
    return () => {
      unlisten.then(fn => fn());
    };
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

  // 点击菜单外关闭
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  // 手动拖动窗口（兼容 Windows 等 data-tauri-drag-region 不生效的平台）
  const handleDragStart = async (e: React.MouseEvent) => {
    if (!dragEnabled || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    try {
      const [winX, winY] = await invoke<[number, number]>('get_window_position');
      isDraggingRef.current = true;
      dragStartRef.current = { winX, winY, mouseX: e.clientX, mouseY: e.clientY };
    } catch (err) {
      console.error('get_window_position failed', err);
    }
  };
  useEffect(() => {
    if (!dragEnabled) return;
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;
      const { winX, winY, mouseX, mouseY } = dragStartRef.current;
      invoke('set_window_position', {
        x: winX + (e.clientX - mouseX),
        y: winY + (e.clientY - mouseY),
      }).catch(() => {});
    };
    const onUp = () => {
      isDraggingRef.current = false;
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragEnabled]);

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
      if (settings.model_path != null && String(settings.model_path).trim()) {
        setSettingsModelPath(String(settings.model_path).trim());
      } else {
        setSettingsModelPath('elsia');
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

  const handleOpenSettings = async () => {
    try {
      await invoke('toggle_window', { label: 'settings', visible: true });
    } catch (e) {
      console.error('Failed to open settings:', e);
      setPetBubble('打不开设置面板喵');
      setTimeout(() => setPetBubble(''), 3000);
    }
  };

  return (
    <div className="h-screen font-sans overflow-hidden relative bg-white/95 rounded-2xl shadow-xl border border-slate-200/80 pt-8">
      <DebugOverlay />
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl gap-3 ${dragEnabled ? 'cursor-move' : ''}`}
        onMouseDown={handleDragStart}
      >
        {/* 聊天框开在助手头顶，不挡脸 */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="pointer-events-auto w-[400px] max-w-[calc(100vw-2rem)] max-h-[45vh] flex flex-col shrink-0 z-10"
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[45vh]">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{activePersona.icon}</span>
                    <span className="font-semibold text-white text-sm">{activePersona.name}</span>
                  </div>
                  <button
                    onClick={() => setShowChat(false)}
                    className="p-1 hover:bg-white/20 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="p-3 space-y-2 overflow-y-auto flex-1 min-h-0">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
                        msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : activePersona.icon}
                      </div>
                      <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
                        <div className={`px-2.5 py-1.5 rounded-xl text-xs ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {msg.role === 'user' ? (
                            <div className="whitespace-pre-wrap">{msg.text}</div>
                          ) : (
                            <div className="prose prose-sm prose-slate max-w-none">
                              {msg.text ? <ReactMarkdown>{msg.text}</ReactMarkdown> : <span className="animate-pulse">...</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-2 border-t border-slate-200 shrink-0">
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
        <div
          className="pointer-events-auto w-[400px] h-[300px] flex items-center justify-center shrink-0 bg-slate-50/80 rounded-xl overflow-hidden"
          onClick={e => e.stopPropagation()}
          onMouseDown={handleDragStart}
        >
          <Live2DPetWithBoundary
            state={petState}
            modelPath={rawModelPath}
            onDoubleClick={handlePetDoubleClick}
          />
        </div>
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
          className="p-3 bg-white rounded-xl shadow-lg border-2 border-slate-200 hover:bg-slate-50 hover:border-indigo-300 transition-colors text-slate-800"
          title="打开聊天"
        >
          <MessageSquare className="w-5 h-5 text-slate-700" />
        </button>
        <button
          onClick={handleOpenSettings}
          className="p-3 bg-white rounded-xl shadow-lg border-2 border-slate-200 hover:bg-slate-50 hover:border-indigo-300 transition-colors text-slate-800"
          title="设置"
        >
          <Settings className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      {/* 右下角菜单小图标 */}
      <div className="absolute bottom-3 right-3 z-[60] flex flex-col items-end" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          className="p-2 bg-white rounded-full shadow-lg border-2 border-slate-200 hover:bg-slate-50 hover:border-indigo-300 transition-colors"
          title="菜单"
        >
          <MoreVertical className="w-5 h-5 text-slate-600" />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              className="absolute bottom-full right-0 mb-2 w-44 py-1 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
            >
              <button
                onClick={() => { handleOpenSettings(); setMenuOpen(false); }}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <Settings className="w-4 h-4 text-slate-500" />
                打开设置
              </button>
              <button
                onClick={() => { setShowChat(!showChat); setMenuOpen(false); }}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-slate-500" />
                {showChat ? '关闭聊天' : '打开聊天'}
              </button>
              <button
                onClick={() => { setDragEnabled((e) => !e); setMenuOpen(false); }}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <GripVertical className="w-4 h-4 text-slate-500" />
                {dragEnabled ? '锁定位置' : '解锁拖动'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
