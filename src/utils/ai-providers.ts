export interface AIProvider {
    id: string;
    name: string;
    models: string[];
    apiKeyRequired: boolean;
    baseUrl?: string;
}

export const AI_PROVIDERS: AIProvider[] = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        models: [
            'gemini-2.5-pro',
            'gemini-2.0-flash',
            'gemini-2.0-flash-thinking-exp',
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b',
        ],
        apiKeyRequired: true,
    },
    {
        id: 'openai',
        name: 'OpenAI',
        models: [
            'gpt-4.5-preview',
            'gpt-4-turbo',
            'gpt-4o',
            'gpt-4',
            'gpt-3.5-turbo',
        ],
        apiKeyRequired: true,
        baseUrl: 'https://api.openai.com/v1',
    },
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        models: [
            'claude-3-7-sonnet-20250219',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
        ],
        apiKeyRequired: true,
        baseUrl: 'https://api.anthropic.com/v1',
    },
    {
        id: 'volcengine',
        name: '火山引擎',
        models: [
            'doubao-pro-32k',
            'doubao-pro-128k',
            'doubao-pro-4k',
            'doubao-lite-4k',
        ],
        apiKeyRequired: true,
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        models: [
            'deepseek-chat',
            'deepseek-reasoner',
        ],
        apiKeyRequired: true,
        baseUrl: 'https://api.deepseek.com/v1',
    },
    {
        id: 'moonshot',
        name: 'Moonshot AI (Kimi)',
        models: [
            'moonshot-v1-8k',
            'moonshot-v1-32k',
            'moonshot-v1-128k',
        ],
        apiKeyRequired: true,
        baseUrl: 'https://api.moonshot.cn/v1',
    },
    {
        id: 'zhipu',
        name: '智谱 AI (GLM)',
        models: [
            'glm-4-plus',
            'glm-4-0520',
            'glm-4-air',
            'glm-4-flash',
        ],
        apiKeyRequired: true,
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    },
];

export interface AIConfig {
    provider: string;
    apiKey: string;
    model: string;
    baseUrl?: string;
}

export class AIService {
    private config: AIConfig;

    constructor(config: AIConfig) {
        this.config = config;
    }

    async *sendMessageStream(
        messages: Array<{ role: string; content: string }>,
        systemInstruction?: string
    ): AsyncGenerator<string, void, unknown> {
        const provider = AI_PROVIDERS.find((p) => p.id === this.config.provider);
        if (!provider) {
            throw new Error(`Provider ${this.config.provider} not found`);
        }

        switch (this.config.provider) {
            case 'gemini':
                yield* this.streamGemini(messages, systemInstruction);
                break;
            case 'volcengine':
            case 'deepseek':
            case 'moonshot':
            case 'zhipu':
            case 'openai':
                yield* this.streamOpenAICompatible(messages, systemInstruction);
                break;
            case 'anthropic':
                yield* this.streamAnthropic(messages, systemInstruction);
                break;
            default:
                throw new Error(`Provider ${this.config.provider} not implemented`);
        }
    }

    private async *streamGemini(
        messages: Array<{ role: string; content: string }>,
        systemInstruction?: string
    ): AsyncGenerator<string, void, unknown> {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const ai = new GoogleGenerativeAI(this.config.apiKey);

        const model = ai.getGenerativeModel({
            model: this.config.model,
            systemInstruction: systemInstruction,
        });

        const chat = model.startChat({
            history: messages.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }))
        });

        const result = await chat.sendMessageStream(messages[messages.length - 1].content);

        for await (const chunk of result.stream) {
            if (chunk.text()) {
                yield chunk.text();
            }
        }
    }
    private async *streamOpenAICompatible(
        messages: Array<{ role: string; content: string }>,
        systemInstruction?: string
    ): AsyncGenerator<string, void, unknown> {
        const baseUrl = this.config.baseUrl || AI_PROVIDERS.find(p => p.id === this.config.provider)?.baseUrl;
        if (!baseUrl) {
            throw new Error('Base URL not configured');
        }

        const raw = systemInstruction
            ? [{ role: 'system', content: systemInstruction }, ...messages]
            : messages;
        const requestMessages = raw.map((m) => ({
            ...m,
            role: m.role === 'model' ? 'assistant' : m.role,
        }));

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: requestMessages,
                stream: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body not available');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.trim().slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        const content = json.choices?.[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    private async *streamAnthropic(
        messages: Array<{ role: string; content: string }>,
        systemInstruction?: string
    ): AsyncGenerator<string, void, unknown> {
        const baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1';
        const requestMessages = messages.map((m) => ({
            ...m,
            role: m.role === 'model' ? 'assistant' : m.role,
        }));

        const response = await fetch(`${baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this.config.model,
                max_tokens: 4096,
                stream: true,
                system: systemInstruction,
                messages: requestMessages,
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body not available');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.trim().slice(6);
                    try {
                        const json = JSON.parse(data);
                        if (json.type === 'content_block_delta') {
                            const content = json.delta?.text;
                            if (content) {
                                yield content;
                            }
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }
}
