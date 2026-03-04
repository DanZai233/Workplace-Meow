import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit } from '@tauri-apps/api/event';
import { GoogleGenAI } from '@google/genai';
import { PERSONAS, QUICK_TOOLS, Message, PetState, Persona } from './constants';
import { Live2DPetWithBoundary } from './components/Live2DPet';
import { useModel } from './hooks/useModel';
import { useTypingAnimation } from './hooks/useMouseTracking';
import { useGlobalMouseFollow } from './hooks/useMouseTracking';
import { PET_DISPLAY_WIDTH, PET_DISPLAY_HEIGHT } from './utils/live2d-manager';
import { AIService, AIConfig } from './lib/ai-providers';
import { Settings, MessageSquare, MoreVertical, GripVertical, Power, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

let aiService: AIService | null = null;

export default function App() {
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [petState, setPetState] = useState<PetState>('idle');
  const [petBubble, setPetBubble] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragEnabled, setDragEnabled] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{
    winX: number;
    winY: number;
    mouseX: number;
    mouseY: number;
    scaleFactor: number;
  } | null>(null);
  const DRAG_THRESHOLD_PX = 5;
  const skipMouseFollowRef = useRef<() => boolean>(() => false);
  skipMouseFollowRef.current = () => isGenerating || isDraggingRef.current;
  const chatStateRef = useRef<{ messages: Message[]; isGenerating: boolean; activePersona: Persona }>({ messages, isGenerating, activePersona });
  const handleSendRef = useRef<(text: string) => Promise<void>>(() => Promise.resolve());
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-pro',
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentModel } = useModel();
  const { startTyping, stopTyping } = useTypingAnimation();
  useGlobalMouseFollow(skipMouseFollowRef);
  const [settingsModelPath, setSettingsModelPath] = useState<string | null>(null);
  // 优先使用设置里保存的模型路径，否则用当前选中的预设路径，否则默认 elsia（避免启动时先显示 SVG 猫）；Live2DPet 内会解析名称
  const rawModelPath =
    (settingsModelPath && String(settingsModelPath).trim()) ||
    (currentModel?.path && currentModel.id !== 'custom' ? currentModel.path : undefined) ||
    'elsia';

  useEffect(() => {
    const w = PET_DISPLAY_WIDTH + 40;
    const h = PET_DISPLAY_HEIGHT + 90;
    invoke('set_main_window_size', { width: w, height: h }).catch(() => {});
  }, []);

  chatStateRef.current = { messages, isGenerating, activePersona };

  // Sync chat state to separate chat window
  useEffect(() => {
    emit('chat-state', chatStateRef.current);
  }, [messages, isGenerating, activePersona]);

  useEffect(() => {
    const unlistenReq = listen('request-chat-state', () => {
      emit('chat-state', chatStateRef.current);
    });
    const unlistenSend = listen<{ text?: string }>('chat-send', (e) => {
      const text = e.payload?.text;
      if (typeof text === 'string' && text.trim()) handleSendRef.current(text.trim());
    });
    return () => {
      unlistenReq.then((fn) => fn());
      unlistenSend.then((fn) => fn());
    };
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

  // 手动拖动窗口：仅移动超过阈值才算拖动，并用 scaleFactor 修正位移（跟手）
  const handleDragStart = async (e: React.MouseEvent) => {
    if (!dragEnabled || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    try {
      const [winX, winY] = await invoke<[number, number]>('get_window_position');
      const scaleFactor = await getCurrentWebviewWindow().scaleFactor();
      dragStartRef.current = {
        winX,
        winY,
        mouseX: e.clientX,
        mouseY: e.clientY,
        scaleFactor,
      };
    } catch (err) {
      console.error('get_window_position failed', err);
      dragStartRef.current = null;
    }
  };
  useEffect(() => {
    if (!dragEnabled) return;
    const onMove = async (e: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.mouseX;
      const dy = e.clientY - start.mouseY;
      if (!isDraggingRef.current) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        isDraggingRef.current = true;
        const [winX, winY] = await invoke<[number, number]>('get_window_position').catch(() => [start.winX, start.winY]);
        dragStartRef.current = { ...start, winX, winY, mouseX: e.clientX, mouseY: e.clientY };
      }
      const scale = dragStartRef.current.scaleFactor;
      const { winX, winY, mouseX, mouseY } = dragStartRef.current;
      invoke('set_window_position', {
        x: Math.round(winX + (e.clientX - mouseX) * scale),
        y: Math.round(winY + (e.clientY - mouseY) * scale),
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
    startTyping();

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
      stopTyping();
      setIsGenerating(false);
    }
  };
  handleSendRef.current = handleSend;

  const handlePetDoubleClick = () => {
    invoke('toggle_window', { label: 'chat', visible: true }).catch(() => {});
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
    <div className="h-screen font-sans overflow-hidden relative rounded-2xl" style={{ background: 'transparent' }}>
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl ${dragEnabled ? 'cursor-move' : ''}`}
        onMouseDown={handleDragStart}
      >
        <div
          className="pointer-events-auto flex items-center justify-center shrink-0 rounded-xl overflow-hidden"
          style={{ width: PET_DISPLAY_WIDTH, height: PET_DISPLAY_HEIGHT, background: 'transparent' }}
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
          onClick={() => invoke('toggle_window', { label: 'chat', visible: true }).catch(() => {})}
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
                onClick={() => { setMenuOpen(false); invoke('toggle_window', { label: 'chat', visible: true }).catch(() => {}); }}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-slate-500" />
                打开聊天
              </button>
              <button
                onClick={() => { setDragEnabled((e) => !e); setMenuOpen(false); }}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <GripVertical className="w-4 h-4 text-slate-500" />
                {dragEnabled ? '锁定位置' : '解锁拖动'}
              </button>
              <button
                onClick={() => { setMenuOpen(false); invoke('open_devtools', { label: 'main' }).catch(() => {}); }}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <Terminal className="w-4 h-4 text-slate-500" />
                打开控制台
              </button>
              <button
                onClick={() => { setMenuOpen(false); invoke('exit_app'); }}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <Power className="w-4 h-4 text-slate-500" />
                关闭程序
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
