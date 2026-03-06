<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { AIService, type AIConfig } from '@/utils/ai-providers'
import { invoke } from '@tauri-apps/api/core'

const messages = ref<{role: string, content: string}[]>([])
const input = ref('')
const isLoading = ref(false)
const aiService = ref<AIService | null>(null)

onMounted(async () => {
  const settings = (await invoke<Record<string, any>>('get_settings').catch(() => ({}))) as Record<string, any>
  const config: AIConfig = {
    provider: (settings.ai_provider as string) || 'gemini',
    apiKey: (settings.api_key as string) || '',
    model: (settings.model_name as string) || 'gemini-2.5-pro'
  }
  if (config.apiKey) {
    aiService.value = new AIService(config)
  }
})

const sendMessage = async () => {
  if (!input.value.trim() || isLoading.value || !aiService.value) return
  
  const userMsg = input.value.trim()
  input.value = ''
  messages.value.push({ role: 'user', content: userMsg })
  messages.value.push({ role: 'assistant', content: '' })
  
  isLoading.value = true
  try {
    const stream = aiService.value.sendMessageStream(
      messages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      '你是一个专业的职场助手。'
    )
    let fullText = ''
    for await (const chunk of stream) {
      fullText += chunk
      messages.value[messages.value.length - 1].content = fullText
    }
  } catch (error) {
    messages.value[messages.value.length - 1].content = '抱歉，出现了错误：' + error
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-screen bg-slate-50 text-slate-800 p-4 font-sans">
    <div class="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
      <div v-if="messages.length === 0" class="text-center text-slate-400 mt-10">
        <p>🐱 和职场喵聊点什么吧...</p>
      </div>
      <div 
        v-for="(msg, idx) in messages" 
        :key="idx"
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div 
          class="max-w-[80%] px-4 py-2 rounded-2xl"
          :class="msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white shadow-sm border border-slate-100'"
        >
          <p class="whitespace-pre-wrap text-sm leading-relaxed">{{ msg.content }}</p>
        </div>
      </div>
    </div>
    
    <div class="flex items-end gap-2 shrink-0">
      <div v-if="!aiService" class="w-full text-center text-red-500 py-2">
        请先在设置中配置 API Key
      </div>
      <template v-else>
        <textarea 
          v-model="input"
          @keydown.enter.prevent="sendMessage"
          placeholder="问点什么吧... (Enter发送)"
          class="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white resize-none text-sm"
          rows="2"
        ></textarea>
        <button 
          @click="sendMessage"
          :disabled="isLoading || !input.trim()"
          class="px-4 py-3 bg-blue-500 text-white rounded-xl shadow focus:outline-none hover:bg-blue-600 disabled:opacity-50 h-[46px]"
        >
          {{ isLoading ? '发送中' : '发送' }}
        </button>
      </template>
    </div>
  </div>
</template>
