import { ref, onMounted, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { AIService, type AIConfig } from '@/utils/ai-providers'
import live2d from '@/utils/live2d'

// Care messages the cat says periodically
const CARE_MESSAGES = [
    '喝杯水吧～保持水分很重要哦 💧',
    '记得站起来活动活动～ 🧘',
    '注意用眼健康，看看远处吧 👀',
    '你今天很棒哦！继续加油 💪',
    '别忘了吃饭啊！身体是革命的本钱 🍚',
    '深呼吸，放松一下肩膀 🌿',
    '抬头挺胸，注意坐姿哦 🪑',
    '今天有什么开心的事吗？😊',
    '复杂的事情拆小一点就不难啦 🧩',
    '有什么需要帮忙的随时喊我哦～ 🐱',
    '你已经很努力了，适当休息也很重要 ☕',
    '别忘了保存文件哦！📁',
]

export function useChatReaction() {
    const isChatReplying = ref(false)
    const showCareBubble = ref(false)
    const careBubbleText = ref('')

    let replyAnimTimer: ReturnType<typeof setInterval> | null = null
    let careTimer: ReturnType<typeof setTimeout> | null = null
    let unlistenStart: (() => void) | null = null
    let unlistenEnd: (() => void) | null = null

    // Simulate typing animation on the cat
    const startTypingAnimation = () => {
        isChatReplying.value = true

        // Simulate keyboard pressing at intervals
        replyAnimTimer = setInterval(() => {
            // Simulate left/right hand pressing
            const isLeft = Math.random() > 0.5
            const paramId = isLeft ? 'CatParamLeftHandDown' : 'CatParamRightHandDown'

            live2d.setParameterValue(paramId, true)

            // Also simulate mouth opening (talking)
            live2d.setParameterValue('ParamMouthOpenY', Math.random() * 0.8 + 0.2)

            // Release after a short delay
            setTimeout(() => {
                live2d.setParameterValue(paramId, false)
                live2d.setParameterValue('ParamMouthOpenY', 0)
            }, 120)
        }, 250)
    }

    const stopTypingAnimation = () => {
        isChatReplying.value = false

        if (replyAnimTimer) {
            clearInterval(replyAnimTimer)
            replyAnimTimer = null
        }

        // Reset all animation params
        live2d.setParameterValue('CatParamLeftHandDown', false)
        live2d.setParameterValue('CatParamRightHandDown', false)
        live2d.setParameterValue('ParamMouthOpenY', 0)
    }

    // Show a random care bubble
    const showRandomCareBubble = () => {
        const idx = Math.floor(Math.random() * CARE_MESSAGES.length)
        careBubbleText.value = CARE_MESSAGES[idx]
        showCareBubble.value = true

        // Auto-hide after 6 seconds
        setTimeout(() => {
            showCareBubble.value = false
        }, 6000)
    }

    // Try to generate an AI care message, fallback to local messages
    const showAICareBubble = async () => {
        try {
            const settings = (await invoke<Record<string, any>>('get_settings').catch(() => ({}))) as Record<string, any>
            const config: AIConfig = {
                provider: (settings.ai_provider as string) || 'gemini',
                apiKey: (settings.api_key as string) || '',
                model: (settings.model_name as string) || 'gemini-2.5-pro',
                baseUrl: (settings.custom_base_url as string) || ''
            }

            if (!config.apiKey) {
                showRandomCareBubble()
                return
            }

            const aiService = new AIService(config)
            const prompt = '你是一个贴心的职场桌面宠物。请用15个字以内简短关心一下正在工作的用户，语气要可爱活泼，可以加emoji。不要用引号。'

            let result = ''
            for await (const chunk of aiService.sendMessageStream([{ role: 'user', content: '关心一下我' }], prompt)) {
                result += chunk
            }

            careBubbleText.value = result.trim() || CARE_MESSAGES[Math.floor(Math.random() * CARE_MESSAGES.length)]
            showCareBubble.value = true

            setTimeout(() => {
                showCareBubble.value = false
            }, 8000)
        } catch {
            showRandomCareBubble()
        }
    }

    // Schedule periodic care bubbles (every 10-20 minutes)
    const scheduleCare = () => {
        const minInterval = 10 * 60 * 1000 // 10 min
        const maxInterval = 20 * 60 * 1000 // 20 min
        const interval = minInterval + Math.random() * (maxInterval - minInterval)

        careTimer = setTimeout(() => {
            // 30% chance to use AI, 70% use local
            if (Math.random() < 0.3) {
                showAICareBubble()
            } else {
                showRandomCareBubble()
            }
            scheduleCare() // reschedule
        }, interval)
    }

    onMounted(async () => {
        // Listen for chat reply events from chat window
        unlistenStart = await listen('chat-reply-start', () => {
            startTypingAnimation()
        })

        unlistenEnd = await listen('chat-reply-end', () => {
            stopTypingAnimation()
        })

        // Start periodic care bubbles
        // Show first care bubble after 5 minutes
        careTimer = setTimeout(() => {
            showRandomCareBubble()
            scheduleCare()
        }, 5 * 60 * 1000)
    })

    onUnmounted(() => {
        stopTypingAnimation()
        unlistenStart?.()
        unlistenEnd?.()
        if (careTimer) clearTimeout(careTimer)
    })

    return {
        isChatReplying,
        showCareBubble,
        careBubbleText,
        showRandomCareBubble,
    }
}
