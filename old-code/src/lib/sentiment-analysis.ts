import type { AIConfig } from './ai-providers';

export type Sentiment = 'positive' | 'negative' | 'neutral' | 'excited' | 'sad' | 'angry' | 'surprised';

export interface EmotionMapping {
  sentiment: Sentiment;
  expressions: string[];
  parameters: Record<string, number>;
}

const EMOTION_MAPPINGS: Record<Sentiment, EmotionMapping> = {
  positive: {
    sentiment: 'positive',
    expressions: ['happy', 'smile', 'joy'],
    parameters: {
      'ParamMouthForm': 1,
      'ParamEyeLOpen': 0.8,
      'ParamEyeROpen': 0.8,
      'ParamBrowLY': 0.3,
      'ParamBrowRY': 0.3,
    }
  },
  excited: {
    sentiment: 'excited',
    expressions: ['excited', 'happy'],
    parameters: {
      'ParamMouthForm': 0.8,
      'ParamEyeLOpen': 1,
      'ParamEyeROpen': 1,
      'ParamBodyAngleX': 0.5,
    }
  },
  negative: {
    sentiment: 'negative',
    expressions: ['sad', 'worried'],
    parameters: {
      'ParamMouthForm': -0.5,
      'ParamEyeLOpen': 0.6,
      'ParamEyeROpen': 0.6,
      'ParamBrowLY': -0.3,
      'ParamBrowRY': -0.3,
    }
  },
  sad: {
    sentiment: 'sad',
    expressions: ['sad', 'cry'],
    parameters: {
      'ParamMouthForm': -0.8,
      'ParamEyeLOpen': 0.5,
      'ParamEyeROpen': 0.5,
      'ParamBrowLY': -0.5,
      'ParamBrowRY': -0.5,
    }
  },
  angry: {
    sentiment: 'angry',
    expressions: ['angry', 'mad'],
    parameters: {
      'ParamMouthForm': 0.3,
      'ParamEyeLOpen': 0.9,
      'ParamEyeROpen': 0.9,
      'ParamBrowLY': -0.6,
      'ParamBrowRY': -0.6,
    }
  },
  surprised: {
    sentiment: 'surprised',
    expressions: ['surprised', 'shock'],
    parameters: {
      'ParamMouthForm': 0.6,
      'ParamEyeLOpen': 1,
      'ParamEyeROpen': 1,
      'ParamBrowLY': -0.4,
      'ParamBrowRY': -0.4,
    }
  },
  neutral: {
    sentiment: 'neutral',
    expressions: ['neutral', 'default'],
    parameters: {
      'ParamMouthForm': 0,
      'ParamEyeLOpen': 0.7,
      'ParamEyeROpen': 0.7,
      'ParamBrowLY': 0,
      'ParamBrowRY': 0,
    }
  }
};

const SENTIMENT_KEYWORDS: Record<Sentiment, string[]> = {
  positive: ['开心', '高兴', '棒', '好', '不错', '优秀', '赞', '成功', '哈哈', '嘿嘿', '太好了', '满意', '喜欢', '爱', 'happy', 'good', 'great', 'awesome', 'love', 'excellent'],
  excited: ['太棒了', '太好了', '超级', '非常', '激动', '兴奋', '终于', '哇', '!', '！！！', 'amazing', 'incredible', 'fantastic'],
  negative: ['不好', '糟糕', '难过', '担心', '焦虑', '压力', '累', '烦', 'problem', 'issue', 'error', 'fail', 'sorry', 'difficult'],
  sad: ['难过', '伤心', '哭', '失望', '遗憾', '伤心', '难过', 'sad', 'cry', 'disappointed', 'sorry'],
  angry: ['生气', '愤怒', '讨厌', '烦', 'angry', 'mad', 'hate', 'annoyed'],
  surprised: ['天哪', '什么', '真的吗', '不会吧', 'wow', '惊讶', 'surprised', 'shocked', 'really'],
  neutral: ['好的', '明白', '知道了', '了解', 'ok', 'ok', 'alright', 'got it', 'understand']
};

export async function analyzeSentiment(text: string): Promise<Sentiment> {
  const lowerText = text.toLowerCase();
  
  for (const [sentiment, keywords] of Object.entries(SENTIMENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return sentiment as Sentiment;
      }
    }
  }

  return 'neutral';
}

export async function analyzeSentimentWithAI(text: string): Promise<Sentiment> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { AIService } = await import('./ai-providers');
    
    const settings = await invoke<Record<string, any>>('get_settings');
    const config: AIConfig = {
      provider: settings.ai_provider || 'gemini',
      apiKey: settings.api_key || '',
      model: settings.model_name || 'gemini-2.5-pro'
    };
    
    if (!config.apiKey) {
      return analyzeSentiment(text);
    }

    const aiService = new AIService(config);
    const systemPrompt = `你是一个情感分析专家。分析文本的情感，只返回以下其中一个词：positive, negative, excited, sad, angry, surprised, neutral。不要返回任何其他内容。`;

    let fullText = '';
    for await (const chunk of aiService.sendMessageStream([{ role: 'user', content: text }], systemPrompt)) {
      fullText += chunk;
    }
    
    const response = fullText.toLowerCase().trim();
    
    if (response && Object.keys(SENTIMENT_KEYWORDS).includes(response)) {
      return response as Sentiment;
    }
  } catch (error) {
    console.error('AI sentiment analysis failed:', error);
  }
  
  return await analyzeSentiment(text);
}

export function getEmotionMapping(sentiment: Sentiment): EmotionMapping {
  return EMOTION_MAPPINGS[sentiment] || EMOTION_MAPPINGS.neutral;
}

export async function applyEmotionToModel(sentiment: Sentiment) {
  const manager = (await import('../utils/live2d-manager')).default;
  const live2dManager = manager.getInstance();
  
  const mapping = getEmotionMapping(sentiment);
  
  try {
    const modelInfo = live2dManager.getModelInfo?.();
    if (!modelInfo) return;

    const matchingExpression = modelInfo.expressions.find(exp => 
      mapping.expressions.some(e => exp.toLowerCase().includes(e))
    );

    if (matchingExpression !== undefined) {
      const index = modelInfo.expressions.indexOf(matchingExpression);
      if (index >= 0) {
        live2dManager.playExpressions(index);
      }
    }

    for (const [paramName, value] of Object.entries(mapping.parameters)) {
      live2dManager.setParameterValue(paramName, value);
    }
  } catch (error) {
    console.error('Failed to apply emotion:', error);
  }
}
