import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { AIService, type AIConfig } from '@/utils/ai-providers'

export interface ActivityAnalysis {
    activity: string
    timestamp: number
    confidence: number
}

export function useActivityMonitoring() {
    const currentActivity = ref('')
    const showActivityBubble = ref(false)
    const showEncouragementBubble = ref(false)
    const encouragementMessage = ref('')

    let screenshotInterval: number | null = null
    let encouragementInterval: number | null = null
    let lastScreenshotTime = 0
    let lastActivity = ''

    const SCREENSHOT_INTERVAL = 5 * 60 * 1000
    const ENCOURAGEMENT_INTERVAL = 30 * 60 * 1000
    const SCREENSHOT_COOLDOWN = 60 * 1000

    const ENCOURAGEMENT_SCENARIOS = {
        working_long: ['你已经工作超过2小时了，站起来走动一下吧～', '连续工作这么久，休息5分钟吧，效率会更高哦！'],
        high_productivity: ['哇！今天的效率真高，为你点赞！👍', '这个节奏太棒了，继续保持！'],
        idle: ['看起来你在休息，享受这段时光吧～', '放松一下也好，为下一个冲刺做准备！'],
        night_work: ['这么晚还在工作，要注意休息哦～', '夜深了，早点休息吧，明天再继续！']
    }

    const takeScreenshot = async () => {
        try {
            const now = Date.now()
            if (now - lastScreenshotTime < SCREENSHOT_COOLDOWN) return null
            lastScreenshotTime = now
            return await invoke<string>('capture_screenshot')
        } catch { return null }
    }

    const analyzeScreenshot = async (path: string) => {
        try {
            const settings = (await invoke<Record<string, any>>('get_settings').catch(() => ({}))) as Record<string, any>
            const config: AIConfig = {
                provider: (settings.ai_provider as string) || 'gemini',
                apiKey: (settings.api_key as string) || '',
                model: (settings.model_name as string) || 'gemini-2.5-pro'
            }
            if (!config.apiKey) return null

            const aiService = new AIService(config)
            const systemPrompt = `你是一个职场助手。请分析用户正在做什么工作，返回一个简短的活动描述（不超过20字）。`

            let fullText = ''
            for await (const chunk of aiService.sendMessageStream([{ role: 'user', content: `图片路径: ${path} 请告诉我用户正在做什么？` }], systemPrompt)) {
                fullText += chunk
            }

            const activity = fullText.trim()
            if (activity && activity !== lastActivity) {
                lastActivity = activity
                currentActivity.value = activity
                return activity
            }
            return null
        } catch { return null }
    }

    const generateEncouragement = async (scenario: keyof typeof ENCOURAGEMENT_SCENARIOS) => {
        try {
            const settings = (await invoke<Record<string, any>>('get_settings').catch(() => ({}))) as Record<string, any>
            const config: AIConfig = {
                provider: (settings.ai_provider as string) || 'gemini',
                apiKey: (settings.api_key as string) || '',
                model: (settings.model_name as string) || 'gemini-2.5-pro'
            }
            if (!config.apiKey) {
                const msgs = ENCOURAGEMENT_SCENARIOS[scenario]
                return msgs[Math.floor(Math.random() * msgs.length)]
            }

            const aiService = new AIService(config)
            const systemPrompt = '你是一个温暖贴心的职场助手，擅长鼓励和安慰。'
            const scenarioText = `当前场景：${scenario}。请生成一句简短鼓励的话（不超过30字）。`

            let fullText = ''
            for await (const chunk of aiService.sendMessageStream([{ role: 'user', content: scenarioText }], systemPrompt)) {
                fullText += chunk
            }
            return fullText.trim()
        } catch {
            const msgs = ENCOURAGEMENT_SCENARIOS[scenario]
            return msgs[Math.floor(Math.random() * msgs.length)]
        }
    }

    const triggerActivityAnalysis = async () => {
        const path = await takeScreenshot()
        if (!path) return
        const activity = await analyzeScreenshot(path)
        if (activity) {
            showActivityBubble.value = true
            setTimeout(() => showActivityBubble.value = false, 10000)
        }
    }

    const triggerEncouragement = async () => {
        const hour = new Date().getHours()
        let scenario: keyof typeof ENCOURAGEMENT_SCENARIOS = 'working_long'

        if (hour >= 0 && hour < 6) scenario = 'night_work'
        else if (currentActivity.value.includes('休息') || currentActivity.value.includes('idle')) scenario = 'idle'
        else if (currentActivity.value.includes('高效') || currentActivity.value.includes('完成')) scenario = 'high_productivity'

        encouragementMessage.value = await generateEncouragement(scenario)
        showEncouragementBubble.value = true
        setTimeout(() => showEncouragementBubble.value = false, 8000)
    }

    onMounted(() => {
        screenshotInterval = window.setInterval(triggerActivityAnalysis, SCREENSHOT_INTERVAL)
        encouragementInterval = window.setInterval(triggerEncouragement, ENCOURAGEMENT_INTERVAL)
    })

    onUnmounted(() => {
        if (screenshotInterval) window.clearInterval(screenshotInterval)
        if (encouragementInterval) window.clearInterval(encouragementInterval)
    })

    return {
        currentActivity,
        showActivityBubble,
        showEncouragementBubble,
        encouragementMessage,
        triggerEncouragement
    }
}
