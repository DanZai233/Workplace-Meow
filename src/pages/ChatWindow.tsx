import { useState, useEffect, useRef } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Message, Persona, PERSONAS, ChatSession } from '../constants';
import { Send, User, X, ChevronDown, Plus, MessageSquare, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatStatePayload {
  sessions?: ChatSession[];
  activeSessionId?: string;
  activeSession?: ChatSession | null;
  personaOptions?: Persona[];
  isGenerating?: boolean;
}

const DEFAULT_PERSONA: Persona = PERSONAS[0];

export default function ChatWindow() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [personaOptions, setPersonaOptions] = useState<Persona[]>([]);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const [sessionListOpen, setSessionListOpen] = useState(true);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const personaMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlisten = listen<ChatStatePayload>('chat-state', (e) => {
      const p = e.payload ?? {};
      if (Array.isArray(p.sessions)) setSessions(p.sessions);
      if (typeof p.activeSessionId === 'string') setActiveSessionId(p.activeSessionId);
      if (p.activeSession !== undefined) setActiveSession(p.activeSession ?? null);
      if (Array.isArray(p.personaOptions)) setPersonaOptions(p.personaOptions);
      if (typeof p.isGenerating === 'boolean') setIsGenerating(p.isGenerating);
    });
    emit('request-chat-state');
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!personaMenuOpen) return;
    const close = (ev: MouseEvent) => {
      if (personaMenuRef.current && !personaMenuRef.current.contains(ev.target as Node)) {
        setPersonaMenuOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [personaMenuOpen]);

  const messages = activeSession?.messages ?? [];
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (text: string) => {
    if (!text.trim() || isGenerating) return;
    setInput('');
    emit('chat-send', { text: text.trim() });
  };

  const options = personaOptions.length > 0 ? personaOptions : [DEFAULT_PERSONA, ...PERSONAS.filter(p => p.id !== DEFAULT_PERSONA.id)];
  const presets = options.filter(p => p.id !== 'custom');
  const customOption = options.find(p => p.id === 'custom');

  const handleSelectPersona = (p: Persona) => {
    setPersonaMenuOpen(false);
    emit('set-active-persona', p);
  };

  const persona = activeSession?.persona ?? DEFAULT_PERSONA;

  return (
    <div className="h-screen flex bg-slate-50 font-sans">
      {/* 会话列表侧栏 */}
      <div
        className={`shrink-0 flex flex-col border-r border-slate-200 bg-white transition-all overflow-hidden ${sessionListOpen ? 'w-52' : 'w-14'}`}
      >
        <div className={`p-2 border-b border-slate-100 flex items-center ${sessionListOpen ? 'min-h-12 justify-between' : 'flex-col gap-1 justify-start py-2'}`}>
          {sessionListOpen ? (
            <span className="text-xs font-medium text-slate-500 px-2">会话</span>
          ) : (
            <span className="text-[10px] text-slate-400 mb-0.5">列表</span>
          )}
          <div className={`flex gap-1 ${sessionListOpen ? '' : 'flex-col'}`}>
            <button
              type="button"
              onClick={() => emit('create-session')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 shrink-0"
              title="新建会话"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSessionListOpen(o => !o)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 shrink-0"
              title={sessionListOpen ? '收起会话列表' : '展开会话列表'}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
        </div>
        {sessionListOpen && (
          <div className="flex-1 overflow-y-auto py-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg cursor-pointer ${activeSessionId === s.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                onClick={() => emit('set-active-session', { id: s.id })}
              >
                <span className="text-base shrink-0">{s.persona.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.title}</div>
                  <div className="text-xs text-slate-500 truncate">{s.persona.name}</div>
                </div>
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); emit('delete-session', { id: s.id }); }}
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-slate-400 hover:text-red-600 shrink-0"
                  title="删除会话"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 主聊天区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div
          data-tauri-drag-region
          className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 flex items-center justify-between shrink-0 cursor-move"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0" ref={personaMenuRef}>
            <button
              type="button"
              onClick={() => setPersonaMenuOpen(o => !o)}
              className="flex items-center gap-2 min-w-0 rounded-lg hover:bg-white/20 px-2 py-1 -mx-2 transition-colors text-left"
              title="当前会话角色"
            >
              <span className="text-lg shrink-0">{persona.icon}</span>
              <span className="font-semibold text-white text-sm truncate">{persona.name}</span>
              <ChevronDown className={`w-4 h-4 shrink-0 text-white/80 transition-transform ${personaMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {personaMenuOpen && (
              <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 py-2 max-h-64 overflow-y-auto">
                <div className="px-3 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide">预设</div>
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPersona(p)}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm hover:bg-slate-50 ${persona.id === p.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800'}`}
                  >
                    <span className="text-lg">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      {p.description && <div className="text-xs text-slate-500 truncate">{p.description}</div>}
                    </div>
                  </button>
                ))}
                {customOption && (
                  <>
                    <div className="px-3 py-1.5 mt-1 text-xs font-medium text-slate-500 uppercase tracking-wide border-t border-slate-100 pt-2">个人设定</div>
                    <button
                      type="button"
                      onClick={() => handleSelectPersona(customOption)}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm hover:bg-slate-50 ${persona.id === 'custom' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800'}`}
                    >
                      <span className="text-lg">{customOption.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{customOption.name}</div>
                        {customOption.description && <div className="text-xs text-slate-500 truncate">{customOption.description}</div>}
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => invoke('toggle_window', { label: 'chat', visible: false }).catch(() => {})}
            className="p-1 hover:bg-white/20 rounded-md transition-colors text-white shrink-0"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 space-y-2 overflow-y-auto flex-1 min-h-0">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
                msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : persona.icon}
            </div>
            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
              <div
                className={`px-2.5 py-1.5 rounded-xl text-xs ${
                  msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <div className="prose prose-sm prose-slate max-w-none">
                    {msg.text ? (
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    ) : (
                      <span className="animate-pulse">...</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-2 border-t border-slate-200 shrink-0 bg-white">
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
            placeholder={`和${persona.name}聊聊...`}
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
    </div>
  );
}
