import { useEffect, useRef, useState, useCallback } from 'react';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import type { AIConfig } from '../lib/ai-providers';

export interface WorkSession {
  startTime: number;
  lastActiveTime: number;
  isPaused: boolean;
}

export function useSystemMonitor() {
  const [clipboardText, setClipboardText] = useState<string>('');
  const [showClipboardAlert, setShowClipboardAlert] = useState(false);
  const [workSession, setWorkSession] = useState<WorkSession>(() => {
    const saved = localStorage.getItem('workSession');
    if (saved) {
      const session = JSON.parse(saved);
      return {
        ...session,
        isPaused: false
      };
    }
    return {
      startTime: Date.now(),
      lastActiveTime: Date.now(),
      isPaused: false
    };
  });
  const [showPomodoroAlert, setShowPomodoroAlert] = useState(false);
  const [workDuration, setWorkDuration] = useState(0);

  const clipboardCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const lastClipboardText = useRef<string>('');
  const lastAlertTime = useRef<number>(0);

  const ALERT_COOLDOWN = 30000;
  const POMODORO_INTERVAL = 2 * 60 * 60 * 1000;
  const WORK_CHECK_INTERVAL = 60000;

  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds}秒`;
    }
    return `${seconds}秒`;
  };

  const generateHighEQReply = async (text: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { AIService } = await import('../lib/ai-providers');
      
      const settings = await invoke<Record<string, any>>('get_settings');
      const config: AIConfig = {
        provider: settings.ai_provider || 'gemini',
        apiKey: settings.api_key || '',
        model: settings.model_name || 'gemini-2.5-pro'
      };
      
      if (!config.apiKey) {
        return '请先在设置中配置AI API密钥。';
      }

      const aiService = new AIService(config);
      const systemPrompt = `你是一个职场沟通专家。请为以下文本生成一个高情商的回复，要求：
1. 语气得体、专业
2. 考虑到对方的感受
3. 给出2-3个不同风格的回复选项
4. 每个回复不超过50字

文本：${text}`;
      
      let fullText = '';
      for await (const chunk of aiService.sendMessageStream([{ role: 'user', content: '请生成高情商回复' }], systemPrompt)) {
        fullText += chunk;
      }
      
      return fullText;
    } catch (error) {
      console.error('Failed to generate high EQ reply:', error);
      return '抱歉，生成回复时出错了。';
    }
  };

  const handleClipboardAlert = useCallback(async (shouldGenerate: boolean) => {
    if (!clipboardText) return;
    
    setShowClipboardAlert(false);
    
    if (shouldGenerate) {
      setClipboardText('');
      const reply = await generateHighEQReply(clipboardText);
      setClipboardText(reply);
      setShowClipboardAlert(true);
    }
  }, [clipboardText]);

  const handlePomodoroAlert = useCallback(() => {
    setShowPomodoroAlert(false);
    
    const newSession: WorkSession = {
      startTime: Date.now(),
      lastActiveTime: Date.now(),
      isPaused: false
    };
    
    setWorkSession(newSession);
    localStorage.setItem('workSession', JSON.stringify(newSession));
  }, []);

  const pauseWorkSession = useCallback(() => {
    const newSession: WorkSession = {
      ...workSession,
      isPaused: true
    };
    setWorkSession(newSession);
    localStorage.setItem('workSession', JSON.stringify(newSession));
  }, [workSession]);

  const resumeWorkSession = useCallback(() => {
    const newSession: WorkSession = {
      startTime: Date.now(),
      lastActiveTime: Date.now(),
      isPaused: false
    };
    setWorkSession(newSession);
    localStorage.setItem('workSession', JSON.stringify(newSession));
  }, []);

  const resetWorkSession = useCallback(() => {
    const newSession: WorkSession = {
      startTime: Date.now(),
      lastActiveTime: Date.now(),
      isPaused: false
    };
    setWorkSession(newSession);
    localStorage.setItem('workSession', JSON.stringify(newSession));
    setShowPomodoroAlert(false);
  }, []);

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await readText();
        
        if (text && text !== lastClipboardText.current && text.length > 10) {
          const now = Date.now();
          const timeSinceLastAlert = now - lastAlertTime.current;
          
          if (timeSinceLastAlert > ALERT_COOLDOWN) {
            lastClipboardText.current = text;
            setClipboardText(text);
            setShowClipboardAlert(true);
            lastAlertTime.current = now;
          }
        }
      } catch (error) {
        console.error('Failed to check clipboard:', error);
      }
    };

    clipboardCheckInterval.current = setInterval(checkClipboard, 2000);
    
    return () => {
      if (clipboardCheckInterval.current) {
        clearInterval(clipboardCheckInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    const checkWorkTime = () => {
      const now = Date.now();
      const currentDuration = now - workSession.startTime;
      setWorkDuration(currentDuration);
      
      if (!workSession.isPaused && currentDuration >= POMODORO_INTERVAL) {
        setShowPomodoroAlert(true);
      }
    };

    const interval = setInterval(checkWorkTime, WORK_CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, [workSession]);

  useEffect(() => {
    const handleUserActivity = () => {
      if (!workSession.isPaused) {
        const newSession: WorkSession = {
          ...workSession,
          lastActiveTime: Date.now()
        };
        setWorkSession(newSession);
        localStorage.setItem('workSession', JSON.stringify(newSession));
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    
    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [workSession]);

  return {
    clipboardText,
    showClipboardAlert,
    setShowClipboardAlert,
    handleClipboardAlert,
    showPomodoroAlert,
    workDuration,
    pauseWorkSession,
    resumeWorkSession,
    resetWorkSession,
    workSession,
  };
}
