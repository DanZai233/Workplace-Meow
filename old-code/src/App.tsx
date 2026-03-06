import { useState, useRef, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen, emit } from '@tauri-apps/api/event';
import { GoogleGenAI } from '@google/genai';
import { PERSONAS, Message, PetState, Persona, ChatSession } from './constants';
import { Live2DPetWithBoundary } from './components/Live2DPet';
import { useModel } from './hooks/useModel';
import { useTypingAnimation } from './hooks/useMouseTracking';
import { useGlobalMouseFollow } from './hooks/useMouseTracking';
import { PET_DISPLAY_WIDTH, PET_DISPLAY_HEIGHT } from './utils/live2d-manager';
import { AIService, AIConfig } from './lib/ai-providers';
import { Settings, MessageSquare, MoreVertical, GripVertical, Power, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

let aiService: AIService | null = null;

const SESSIONS_STORAGE_KEY = 'workplace-meow-sessions';
const ACTIVE_SESSION_KEY = 'workplace-meow-active-session-id';

function isValidPersona(p: unknown): p is Persona {
  return p != null && typeof p === 'object' && 'id' in p && 'name' in p && 'prompt' in p;
}

function normalizeSession(s: unknown): ChatSession | null {
  if (!s || typeof s !== 'object' || !('id' in s) || !('messages' in s) || !('persona' in s)) return null;
  const o = s as Record<string, unknown>;
  const persona = o.persona;
  const validPersona = isValidPersona(persona) ? persona : PERSONAS[0];
  const messages = Array.isArray(o.messages)
    ? (o.messages as Message[]).filter(m => m && typeof m === 'object' && 'id' in m && 'role' in m && 'text' in m)
    : [];
  return {
    id: String(o.id ?? ''),
    title: String(o.title ?? '新会话'),
    persona: validPersona,
    messages,
    createdAt: Number(o.createdAt ?? Date.now()),
  };
}

function loadSessionsFromStorage(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: ChatSession[] = [];
    for (const item of parsed) {
      const s = normalizeSession(item);
      if (s && s.id) out.push(s);
    }
    return out;
  } catch {
    return [];
  }
}

function createEmptySession(persona: Persona): ChatSession {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: '新会话',
    persona,
    messages: [],
    createdAt: Date.now(),
  };
}

export default function App() {
  const [customAssistantFromSettings, setCustomAssistantFromSettings] = useState<{
    name: string;
    icon: string;
    description: string;
    prompt: string;
  }>({ name: '', icon: '🐱', description: '', prompt: '' });
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = loadSessionsFromStorage();
    if (stored.length > 0) return stored;
    return [createEmptySession(PERSONAS[0])];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const id = localStorage.getItem(ACTIVE_SESSION_KEY);
    const stored = loadSessionsFromStorage();
    const list = stored.length > 0 ? stored : [createEmptySession(PERSONAS[0])];
    if (id && list.some((s: ChatSession) => s.id === id)) return id;
    return list[0]?.id ?? '';
  });
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [petState, setPetState] = useState<PetState>('idle');
  const [petBubble, setPetBubble] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragEnabled, setDragEnabled] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const skipMouseFollowRef = useRef<() => boolean>(() => false);
  skipMouseFollowRef.current = () => isGenerating;
  const chatStateRef = useRef<Record<string, unknown>>({});
  const handleSendRef = useRef<(text: string) => Promise<void>>(() => Promise.resolve());
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-pro',
  });
  
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

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) ?? sessions[0] ?? null,
    [sessions, activeSessionId]
  );

  useEffect(() => {
    if (sessions.length === 0) {
      setSessions([createEmptySession(PERSONAS[0])]);
      return;
    }
    if (!activeSessionId || !sessions.some(s => s.id === activeSessionId)) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (activeSessionId) localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch (_) {}
  }, [sessions]);

  const personaOptions = useMemo(() => {
    const custom = customAssistantFromSettings.name.trim()
      ? ({ id: 'custom' as const, ...customAssistantFromSettings } as Persona)
      : null;
    return custom ? [...PERSONAS, custom] : [...PERSONAS];
  }, [customAssistantFromSettings.name, customAssistantFromSettings.icon, customAssistantFromSettings.description, customAssistantFromSettings.prompt]);

  const chatStatePayload = useMemo(() => ({
    sessions,
    activeSessionId,
    activeSession,
    personaOptions,
    isGenerating,
  }), [sessions, activeSessionId, activeSession, personaOptions, isGenerating]);
  chatStateRef.current = chatStatePayload;

  useEffect(() => {
    emit('chat-state', chatStatePayload);
  }, [chatStatePayload]);

  useEffect(() => {
    const unlistenReq = listen('request-chat-state', () => {
      emit('chat-state', chatStateRef.current);
    });
    const unlistenSend = listen<{ text?: string }>('chat-send', (e) => {
      const text = e.payload?.text;
      if (typeof text === 'string' && text.trim()) handleSendRef.current(text.trim());
    });
    const unlistenSetPersona = listen<Persona>('set-active-persona', (e) => {
      const p = e.payload;
      if (!p || p.id == null || !p.name || p.prompt == null || !activeSessionId) return;
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, persona: p } : s));
    });
    const unlistenSetSession = listen<{ id: string }>('set-active-session', (e) => {
      const id = e.payload?.id;
      if (id && sessions.some(s => s.id === id)) setActiveSessionId(id);
    });
    const unlistenCreateSession = listen('create-session', () => {
      const defaultPersona = PERSONAS[0];
      const newSession = createEmptySession(defaultPersona);
      setSessions(prev => [...prev, newSession]);
      setActiveSessionId(newSession.id);
    });
    const unlistenDeleteSession = listen<{ id: string }>('delete-session', (e) => {
      const id = e.payload?.id;
      if (!id) return;
      setSessions(prev => {
        const next = prev.filter(s => s.id !== id);
        return next.length === 0 ? [createEmptySession(PERSONAS[0])] : next;
      });
    });
    return () => {
      unlistenReq.then((fn) => fn());
      unlistenSend.then((fn) => fn());
      unlistenSetPersona.then((fn) => fn());
      unlistenSetSession.then((fn) => fn());
      unlistenCreateSession.then((fn) => fn());
      unlistenDeleteSession.then((fn) => fn());
    };
  }, [activeSessionId, sessions]);

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

  // 手动拖动窗口：使用 Tauri 提供的原生 startDragging 方法
  const handleDragStart = async (e: React.MouseEvent) => {
    if (!dragEnabled || (e.target as HTMLElement).closest('button')) return;
    // 只有鼠标左键按下时才触发拖拽
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      await getCurrentWebviewWindow().startDragging();
    } catch (err) {
      console.error('startDragging failed', err);
    }
  };

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
      const custom = {
        name: String(settings.assistant_name ?? '').trim(),
        icon: String(settings.assistant_icon ?? '🐱').trim() || '🐱',
        description: String(settings.assistant_description ?? '').trim(),
        prompt: String(settings.assistant_prompt ?? '').trim(),
      };
      setCustomAssistantFromSettings(prev => ({ ...prev, ...custom }));
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isGenerating || !activeSession) return;

    const sid = activeSession.id;
    const userMsgId = Date.now().toString();
    const modelMsgId = (Date.now() + 1).toString();
    const userMsg: Message = { id: userMsgId, role: 'user', text };
    const modelPlaceholder: Message = { id: modelMsgId, role: 'model', text: '' };
    setSessions(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const nextMessages = [...s.messages, userMsg, modelPlaceholder];
      const title = s.title === '新会话' && text.trim() ? text.trim().slice(0, 20) + (text.length > 20 ? '...' : '') : s.title;
      return { ...s, messages: nextMessages, title };
    }));
    setInput('');
    setPetState('typing');
    setPetBubble('');
    setIsGenerating(true);
    startTyping();

    const baseMessages = activeSession.messages.map(m => ({ role: m.role, content: m.text }));
    const chatMessages = [...baseMessages, { role: 'user', content: text }];

    try {
      let fullText = '';
      if (aiService) {
        for await (const chunk of aiService.sendMessageStream(chatMessages, activeSession.persona.prompt)) {
          fullText += chunk;
          setSessions(prev => prev.map(s => {
            if (s.id !== sid) return s;
            return { ...s, messages: s.messages.map(m => m.id === modelMsgId ? { ...m, text: fullText } : m) };
          }));
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
      setSessions(prev => prev.map(s => {
        if (s.id !== sid) return s;
        return { ...s, messages: s.messages.map(m => m.id === modelMsgId ? { ...m, text: '抱歉，我遇到了一点问题，请稍后再试。' } : m) };
      }));
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
