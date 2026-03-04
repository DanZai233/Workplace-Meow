import { useState, useEffect, useRef } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Message, Persona } from '../constants';
import { Send, User, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatStatePayload {
  messages: Message[];
  isGenerating: boolean;
  activePersona: Persona | null;
}

const DEFAULT_PERSONA: Persona = {
  id: 'mentor',
  name: '老练导师',
  icon: '🦉',
  description: '',
  prompt: '',
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlisten = listen<ChatStatePayload>('chat-state', (e) => {
      const { messages: m, isGenerating: g, activePersona: p } = e.payload ?? {};
      if (Array.isArray(m)) setMessages(m);
      if (typeof g === 'boolean') setIsGenerating(g);
      if (p != null) setActivePersona(p);
    });
    emit('request-chat-state');
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (text: string) => {
    if (!text.trim() || isGenerating) return;
    setInput('');
    emit('chat-send', { text: text.trim() });
  };

  const persona = activePersona ?? DEFAULT_PERSONA;

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{persona.icon}</span>
          <span className="font-semibold text-white text-sm">{persona.name}</span>
        </div>
        <button
          type="button"
          onClick={() => invoke('toggle_window', { label: 'chat', visible: false }).catch(() => {})}
          className="p-1 hover:bg-white/20 rounded-md transition-colors text-white"
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
  );
}
