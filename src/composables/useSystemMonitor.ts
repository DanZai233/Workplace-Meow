import { ref, onMounted, onUnmounted, watch } from 'vue'
import { readText } from '@tauri-apps/plugin-clipboard-manager'
import { AIService, type AIConfig } from '@/utils/ai-providers'
import { invoke } from '@tauri-apps/api/core'

export interface WorkSession {
    startTime: number
    lastActiveTime: number
    isPaused: boolean
}

export function useSystemMonitor() {
    const clipboardText = ref('')
    const showClipboardAlert = ref(false)
    const workSession = ref<WorkSession>((() => {
        const saved = localStorage.getItem('workSession')
        if (saved) {
            const session = JSON.parse(saved)
            return { ...session, isPaused: false }
        }
        return { startTime: Date.now(), lastActiveTime: Date.now(), isPaused: false }
    })())
    const showPomodoroAlert = ref(false)
    const workDuration = ref(0)

    let clipboardCheckInterval: number | null = null
    let workCheckInterval: number | null = null
    let lastClipboardText = ''
    let lastAlertTime = 0

    const ALERT_COOLDOWN = 30000
    const POMODORO_INTERVAL = 2 * 60 * 60 * 1000
    const WORK_CHECK_INTERVAL = 60000

    const formatDuration = (ms: number): string => {
        const hours = Math.floor(ms / (1000 * 60 * 60))
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((ms % (1000 * 60)) / 1000)

        if (hours > 0) return `${hours}小时${minutes}分钟`
        if (minutes > 0) return `${minutes}分钟${seconds}秒`
        return `${seconds}秒`
    }

    const generateHighEQReply = async (text: string) => {
        try {
            const settings = (await invoke<Record<string, any>>('get_settings').catch(() => ({}))) as Record<string, any>
            const config: AIConfig = {
                provider: (settings.ai_provider as string) || 'gemini',
                apiKey: (settings.api_key as string) || '',
                model: (settings.model_name as string) || 'gemini-2.5-pro'
            }
            if (!config.apiKey) return '请先在设置中配置AI API密钥。'

            const aiService = new AIService(config)
            const systemPrompt = `你是一个职场沟通专家。请为以下文本生成一个高情商的回复，要求：
1. 语气得体、专业
2. 考虑到对方的感受
3. 给出2-3个不同风格的回复选项
4. 每个回复不超过50字

文本：${text}`

            let fullText = ''
            for await (const chunk of aiService.sendMessageStream([{ role: 'user', content: '请生成高情商回复' }], systemPrompt)) {
                fullText += chunk
            }
            return fullText
        } catch (error) {
            console.error('Failed to generate high EQ reply:', error)
            return '抱歉，生成回复时出错了。'
        }
    }

    const handleClipboardAlert = async (shouldGenerate: boolean) => {
        if (!clipboardText.value) return
        showClipboardAlert.value = false
        if (shouldGenerate) {
            const originalText = clipboardText.value
            clipboardText.value = '生成中...'
            showClipboardAlert.value = true
            const reply = await generateHighEQReply(originalText)
            clipboardText.value = reply
        }
    }

    const handlePomodoroAlert = () => {
        showPomodoroAlert.value = false
        const newSession = { startTime: Date.now(), lastActiveTime: Date.now(), isPaused: false }
        workSession.value = newSession
        localStorage.setItem('workSession', JSON.stringify(newSession))
    }

    onMounted(() => {
        clipboardCheckInterval = window.setInterval(async () => {
            try {
                const text = await readText()
                if (text && text !== lastClipboardText && text.length > 10) {
                    const now = Date.now()
                    if (now - lastAlertTime > ALERT_COOLDOWN) {
                        lastClipboardText = text
                        clipboardText.value = text
                        showClipboardAlert.value = true
                        lastAlertTime = now
                    }
                }
            } catch (e) { }
        }, 2000)

        workCheckInterval = window.setInterval(() => {
            const now = Date.now()
            const currentDuration = now - workSession.value.startTime
            workDuration.value = currentDuration
            if (!workSession.value.isPaused && currentDuration >= POMODORO_INTERVAL) {
                showPomodoroAlert.value = true
            }
        }, WORK_CHECK_INTERVAL)

        const handleUserActivity = () => {
            if (!workSession.value.isPaused) {
                workSession.value.lastActiveTime = Date.now()
                localStorage.setItem('workSession', JSON.stringify(workSession.value))
            }
        }
        window.addEventListener('mousemove', handleUserActivity)
        window.addEventListener('keydown', handleUserActivity)
    })

    onUnmounted(() => {
        if (clipboardCheckInterval) window.clearInterval(clipboardCheckInterval)
        if (workCheckInterval) window.clearInterval(workCheckInterval)
    })

    return {
        clipboardText,
        showClipboardAlert,
        handleClipboardAlert,
        showPomodoroAlert,
        handlePomodoroAlert,
        workDuration,
        formatDuration,
        workSession
    }
}
