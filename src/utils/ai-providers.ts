export interface AIProvider {
    id: string
    name: string
    models: string[]
    apiKeyRequired: boolean
    baseUrl?: string
}

export const AI_PROVIDERS: AIProvider[] = [
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-pro', 'gemini-1.5-pro'], apiKeyRequired: true },
    { id: 'openai', name: 'OpenAI', models: ['gpt-4-turbo', 'gpt-3.5-turbo'], apiKeyRequired: true, baseUrl: 'https://api.openai.com/v1' },
    { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'], apiKeyRequired: true, baseUrl: 'https://api.deepseek.com/v1' }
]

export interface AIConfig {
    provider: string
    apiKey: string
    model: string
    baseUrl?: string
}

export class AIService {
    private config: AIConfig

    constructor(config: AIConfig) {
        this.config = config
    }

    async *sendMessageStream(
        messages: Array<{ role: string; content: string }>,
        systemInstruction?: string
    ): AsyncGenerator<string, void, unknown> {
        if (this.config.provider === 'gemini') {
            yield* this.streamGemini(messages, systemInstruction)
        } else {
            yield* this.streamOpenAICompatible(messages, systemInstruction)
        }
    }

    private async *streamGemini(
        messages: Array<{ role: string; content: string }>,
        systemInstruction?: string
    ): AsyncGenerator<string, void, unknown> {
        const { GoogleGenerativeAI } = await import('@google/genai').catch(() => { throw new Error('not installed') });
        // @ts-ignore
        const ai = new GoogleGenerativeAI({ apiKey: this.config.apiKey })
        // @ts-ignore
        const chat = ai.chats.create({
            model: this.config.model,
            config: { systemInstruction }
        })
        // @ts-ignore
        const response = await chat.sendMessageStream({ message: messages[messages.length - 1].content })
        for await (const chunk of response) {
            if (chunk.text) yield chunk.text
        }
    }

    private async *streamOpenAICompatible(
        messages: Array<{ role: string; content: string }>,
        systemInstruction?: string
    ): AsyncGenerator<string, void, unknown> {
        const baseUrl = this.config.baseUrl || AI_PROVIDERS.find(p => p.id === this.config.provider)?.baseUrl

        // Convert 'model' role to 'assistant' for OpenAI-compatible APIs
        const raw = systemInstruction ? [{ role: 'system', content: systemInstruction }, ...messages] : messages
        const requestMessages = raw.map(m => ({
            ...m, role: m.role === 'model' ? 'assistant' : m.role
        }))

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: requestMessages,
                stream: true
            })
        })

        if (!response.body) return
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6)
                    if (data === '[DONE]') continue
                    try {
                        const json = JSON.parse(data)
                        const content = json.choices?.[0]?.delta?.content
                        if (content) yield content
                    } catch { }
                }
            }
        }
    }
}
