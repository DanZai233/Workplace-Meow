import { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { AIConfig } from '../lib/ai-providers';

const appWindow = getCurrentWebviewWindow();

export interface ActivityAnalysis {
  activity: string;
  timestamp: number;
  confidence: number;
}

export interface ScreenshotInfo {
  timestamp: number;
  analyzed: boolean;
  activity?: string;
}

export function useActivityMonitoring() {
  const [currentActivity, setCurrentActivity] = useState<string>('');
  const [activityHistory, setActivityHistory] = useState<ActivityAnalysis[]>([]);
  const [showActivityBubble, setShowActivityBubble] = useState(false);
  const [showEncouragementBubble, setShowEncouragementBubble] = useState(false);
  
  const analysisInterval = useRef<NodeJS.Timeout | null>(null);
  const screenshotInterval = useRef<NodeJS.Timeout | null>(null);
  const encouragementInterval = useRef<NodeJS.Timeout | null>(null);
  const lastScreenshotTime = useRef<number>(0);
  const lastActivity = useRef<string>('');

  const SCREENSHOT_INTERVAL = 5 * 60 * 1000; // 每5分钟截图一次
  const ACTIVITY_ANALYSIS_INTERVAL = 10 * 1000; // 每10秒分析一次
  const ENCOURAGEMENT_INTERVAL = 30 * 60 * 1000; // 每30分钟鼓励一次
  const SCREENSHOT_COOLDOWN = 60 * 1000; // 截图冷却1分钟

  const ENCOURAGEMENT_MESSAGES = [
    '你已经连续工作很长时间了，休息一下眼睛吧！',
    '保持这个节奏，你做得很好！',
    '喝水了吗？记得保持水分哦！',
    '深呼吸，放松一下肩膀～',
    '今天的效率真高，继续保持！',
    '站起来走两步，活动活动身体',
    '你已经完成了很多工作，为你感到骄傲！',
    '别忘了伸展一下，保护你的腰椎和颈椎',
    '你的专注力真强，佩服！',
  ];

  const ENCOURAGEMENT_SCENARIOS = {
    working_long: [
      '你已经工作超过2小时了，站起来走动一下吧～',
      '连续工作这么久，休息5分钟吧，效率会更高哦！',
      '该休息一下了，喝杯水，伸个懒腰～',
    ],
    high_productivity: [
      '哇！今天的效率真高，为你点赞！👍',
      '这个节奏太棒了，继续保持！',
      '看你这么专注，真佩服！',
    ],
    idle: [
      '看起来你在休息，享受这段时光吧～',
      '放松一下也好，为下一个冲刺做准备！',
      '好好休息，才能走更远的路！',
    ],
    night_work: [
      '这么晚还在工作，要注意休息哦～',
      '夜深了，早点休息吧，明天再继续！',
      '熬夜伤身体，记得早点睡～',
    ],
  };

  const takeScreenshot = useCallback(async (): Promise<string | null> => {
    try {
      const now = Date.now();
      const timeSinceLastScreenshot = now - lastScreenshotTime.current;
      
      if (timeSinceLastScreenshot < SCREENSHOT_COOLDOWN) {
        console.log('Screenshot cooldown active');
        return null;
      }

      lastScreenshotTime.current = now;
      
      const screenshotPath = await invoke<string>('capture_screenshot');
      
      return screenshotPath;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return null;
    }
  }, []);

  const analyzeScreenshot = useCallback(async (screenshotPath: string): Promise<string | null> => {
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
        return null;
      }

      const aiService = new AIService(config);
      const systemPrompt = `你是一个职场助手。请分析用户正在做什么工作，返回一个简短的活动描述（不超过20字）。
活动类型包括：编程、文档编辑、会议、浏览网页、休息等。`;

      const prompt = '请告诉我用户正在做什么？';
      
      let fullText = '';
      for await (const chunk of aiService.sendMessageStream([{ role: 'user', content: prompt }], systemPrompt)) {
        fullText += chunk;
      }
      
      const activity = fullText.trim();
      
      if (activity && activity !== lastActivity.current) {
        lastActivity.current = activity;
        
        const newAnalysis: ActivityAnalysis = {
          activity,
          timestamp: Date.now(),
          confidence: 0.8
        };
        
        setActivityHistory(prev => [...prev.slice(-9), newAnalysis]);
        setCurrentActivity(activity);
        
        return activity;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to analyze screenshot:', error);
      return null;
    }
  }, []);

  const generateEncouragement = useCallback(async (scenario?: keyof typeof ENCOURAGEMENT_SCENARIOS): Promise<string> => {
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
        const messages = ENCOURAGEMENT_SCENARIOS[scenario || 'working_long'];
        return messages[Math.floor(Math.random() * messages.length)];
      }

      const aiService = new AIService(config);
      
      const scenarioText = scenario 
        ? `当前场景：${scenario}。请生成一句简短鼓励的话（不超过30字）。`
        : '请生成一句简短鼓励的话（不超过30字），要温暖积极。';
      
      const systemPrompt = '你是一个温暖贴心的职场助手，擅长鼓励和安慰。';

      let fullText = '';
      for await (const chunk of aiService.sendMessageStream([{ role: 'user', content: scenarioText }], systemPrompt)) {
        fullText += chunk;
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('Failed to generate encouragement:', error);
      const messages = ENCOURAGEMENT_SCENARIOS[scenario || 'working_long'];
      return messages[Math.floor(Math.random() * messages.length)];
    }
  }, []);

  const initiateConversation = useCallback(async (context?: string): Promise<string> => {
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
        return '看到你在努力工作，需要帮忙吗？';
      }

      const aiService = new AIService(config);
      
      const contextText = context 
        ? `我注意到你正在：${context}。`
        : '注意到你工作很专注。';
      
      const prompt = `${contextText}我想关心一下你的状态，有没有什么我可以帮你的？请回复一句简短的关心的话（不超过40字）。`;
      
      const systemPrompt = '你是一个关心体贴的职场助手，会主动关心用户的工作状态和需求。';

      let fullText = '';
      for await (const chunk of aiService.sendMessageStream([{ role: 'user', content: prompt }], systemPrompt)) {
        fullText += chunk;
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('Failed to initiate conversation:', error);
      return '看到你在努力工作，需要帮忙吗？';
    }
  }, []);

  const triggerActivityAnalysis = useCallback(async () => {
    const screenshotPath = await takeScreenshot();
    
    if (!screenshotPath) return;
    
    const activity = await analyzeScreenshot(screenshotPath);
    
    if (activity) {
      setShowActivityBubble(true);
      setTimeout(() => setShowActivityBubble(false), 10000);
    }
  }, [takeScreenshot, analyzeScreenshot]);

  const triggerEncouragement = useCallback(async () => {
    const now = new Date();
    const hour = now.getHours();
    
    let scenario: keyof typeof ENCOURAGEMENT_SCENARIOS = 'working_long';
    
    if (hour >= 0 && hour < 6) {
      scenario = 'night_work';
    } else if (currentActivity.includes('休息') || currentActivity.includes('idle')) {
      scenario = 'idle';
    } else if (currentActivity.includes('高效') || currentActivity.includes('完成')) {
      scenario = 'high_productivity';
    }
    
    const message = await generateEncouragement(scenario);
    
    setShowEncouragementBubble(true);
    
    setTimeout(() => {
      setShowEncouragementBubble(false);
    }, 8000);
  }, [currentActivity, generateEncouragement]);

  const triggerConversation = useCallback(async () => {
    const message = await initiateConversation(currentActivity);
    setCurrentActivity(message);
    setShowActivityBubble(true);
    
    setTimeout(() => {
      setShowActivityBubble(false);
    }, 15000);
  }, [currentActivity, initiateConversation]);

  useEffect(() => {
    screenshotInterval.current = setInterval(triggerActivityAnalysis, SCREENSHOT_INTERVAL);
    
    return () => {
      if (screenshotInterval.current) {
        clearInterval(screenshotInterval.current);
      }
    };
  }, [triggerActivityAnalysis]);

  useEffect(() => {
    encouragementInterval.current = setInterval(triggerEncouragement, ENCOURAGEMENT_INTERVAL);
    
    return () => {
      if (encouragementInterval.current) {
        clearInterval(encouragementInterval.current);
      }
    };
  }, [triggerEncouragement]);

  return {
    currentActivity,
    activityHistory,
    showActivityBubble,
    showEncouragementBubble,
    triggerEncouragement,
    triggerConversation,
  };
}
