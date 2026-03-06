<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { AIService, type AIConfig } from '@/utils/ai-providers'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { isMac } from '@/utils/platform'
import { nanoid } from 'nanoid'

const appWindow = getCurrentWebviewWindow()

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}

const sessions = ref<ChatSession[]>([])
const currentSessionId = ref<string>('')

const input = ref('')
const isLoading = ref(false)
const aiService = ref<AIService | null>(null)
const assistantConfig = ref({
  name: '职场喵',
  icon: '🐱',
  prompt: '你是一个专业的职场助手。',
})
const chatContainerRef = ref<HTMLElement | null>(null)

const currentSession = computed(() => {
  return sessions.value.find(s => s.id === currentSessionId.value) || null
})

// Scroll chat to bottom
const scrollToBottom = async () => {
  await nextTick()
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
  }
}

const createNewSession = () => {
  const newSession: ChatSession = {
    id: nanoid(),
    title: '新对话',
    messages: [],
    updatedAt: Date.now()
  }
  sessions.value.unshift(newSession)
  currentSessionId.value = newSession.id
  saveSessions()
}

const selectSession = (id: string) => {
  currentSessionId.value = id
  scrollToBottom()
}

const deleteSession = (id: string) => {
  sessions.value = sessions.value.filter(s => s.id !== id)
  if (currentSessionId.value === id) {
    if (sessions.value.length > 0) {
      currentSessionId.value = sessions.value[0].id
    } else {
      createNewSession()
    }
  }
  saveSessions()
}

const saveSessions = () => {
  localStorage.setItem('chat_sessions', JSON.stringify(sessions.value))
}

const loadSessions = () => {
  const saved = localStorage.getItem('chat_sessions')
  if (saved) {
    try {
      sessions.value = JSON.parse(saved)
      if (sessions.value.length > 0) {
        currentSessionId.value = sessions.value[0].id
      } else {
        createNewSession()
      }
    } catch (e) {
      createNewSession()
    }
  } else {
    createNewSession()
  }
}

onMounted(async () => {
  loadSessions()

  const settings = (await invoke<Record<string, any>>('get_settings').catch(() => ({}))) as Record<string, any>
  const config: AIConfig = {
    provider: (settings.ai_provider as string) || 'gemini',
    apiKey: (settings.api_key as string) || '',
    model: (settings.model_name as string) || 'gemini-2.5-pro',
    baseUrl: (settings.custom_base_url as string) || ''
  }
  if (config.apiKey) {
    aiService.value = new AIService(config)
  }
  assistantConfig.value = {
    name: (settings.custom_assistant_name as string) || '职场喵',
    icon: (settings.custom_assistant_icon as string) || '🐱',
    prompt: (settings.custom_assistant_prompt as string) || '你是一个超级厉害的职场助手，你熟悉所有的编程、营销、策划知识。'
  }
  scrollToBottom()
})

const sendMessage = async () => {
  if (!input.value.trim() || isLoading.value || !aiService.value || !currentSession.value) return
  
  const userMsg = input.value.trim()
  input.value = ''
  
  // Auto generate title for new session
  if (currentSession.value.messages.length === 0) {
    currentSession.value.title = userMsg.slice(0, 15) + (userMsg.length > 15 ? '...' : '')
  }
  
  currentSession.value.messages.push({ role: 'user', content: userMsg })
  currentSession.value.messages.push({ role: 'assistant', content: '' })
  currentSession.value.updatedAt = Date.now()
  saveSessions()
  scrollToBottom()
  
  isLoading.value = true
  
  // Emit event to main window to trigger typing/talking animation
  emit('chat-reply-start')
  
  try {
    const stream = aiService.value.sendMessageStream(
      currentSession.value.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
      assistantConfig.value.prompt
    )
    let fullText = ''
    for await (const chunk of stream) {
      fullText += chunk
      currentSession.value.messages[currentSession.value.messages.length - 1].content = fullText
      scrollToBottom()
    }
  } catch (error) {
    currentSession.value.messages[currentSession.value.messages.length - 1].content = '抱歉，出现了错误：' + error
  } finally {
    isLoading.value = false
    emit('chat-reply-end') // Stop typing/talking animation
    saveSessions()
  }
}

const minimizeWindow = () => appWindow.minimize()
const closeWindow = () => appWindow.hide() // just hide to keep state

</script>

<template>
  <div class="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
    <!-- Sidebar -->
    <div class="w-64 bg-slate-100 flex flex-col border-r border-slate-200 shrink-0 select-none">
      <div 
        class="h-14 flex items-center justify-between px-4 border-b border-slate-200 bg-slate-100/50"
        data-tauri-drag-region
      >
        <div class="font-bold flex items-center gap-2 pointer-events-none text-slate-700">
          <span class="text-xl">{{ assistantConfig.icon }}</span>
          <span>会话列表</span>
        </div>
        <button @click="createNewSession" class="text-blue-500 hover:text-blue-600 p-1" title="新对话">
          <div class="i-solar:add-circle-bold size-5" />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <div 
          v-for="session in sessions" :key="session.id"
          class="group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
          :class="currentSessionId === session.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-200 text-slate-600'"
          @click="selectSession(session.id)"
        >
          <div class="truncate text-sm font-medium pr-2 flex-1">{{ session.title }}</div>
          <button 
            @click.stop="deleteSession(session.id)" 
            class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-1"
          >
            <div class="i-solar:trash-bin-minimalistic-bold size-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Main Chat Area -->
    <div class="flex-1 flex flex-col bg-white">
      <!-- Titlebar -->
      <div 
        class="h-14 border-b border-slate-100 flex items-center justify-between px-4"
        data-tauri-drag-region
      >
        <div class="font-bold flex items-center gap-2 pointer-events-none">
          <span class="text-xl">{{ assistantConfig.icon }}</span>
          <span class="text-slate-800">{{ assistantConfig.name }}</span>
        </div>
        
        <!-- Window Controls -->
        <div class="flex items-center gap-2">
          <button @click="minimizeWindow" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <div class="i-solar:minimize-square-minimalistic-linear size-4" />
          </button>
          <button @click="closeWindow" class="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-full transition-colors">
            <div class="i-solar:close-square-linear size-4" />
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div class="flex-1 overflow-y-auto p-4 space-y-4" ref="chatContainerRef">
        <div v-if="!currentSession || currentSession.messages.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400">
          <div class="text-6xl mb-4">{{ assistantConfig.icon }}</div>
          <p>和 {{ assistantConfig.name }} 聊点什么吧...</p>
        </div>
        <template v-else>
          <div 
            v-for="(msg, idx) in currentSession.messages" 
            :key="idx"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div v-if="msg.role === 'assistant'" class="mr-2 shrink-0">
               <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-lg">{{ assistantConfig.icon }}</div>
            </div>
            <div 
              class="max-w-[80%] px-4 py-2 rounded-2xl"
              :class="msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-slate-50 text-slate-800 rounded-bl-sm border border-slate-100 shadow-sm'"
            >
              <p class="whitespace-pre-wrap text-[15px] leading-relaxed break-words" style="word-break: break-all;">{{ msg.content }}</p>
            </div>
          </div>
        </template>
      </div>
      
      <!-- Input Area -->
      <div class="p-4 bg-white border-t border-slate-50">
        <div v-if="!aiService" class="w-full text-center text-red-500 py-2 bg-red-50 rounded-lg">
          请先在 设置 -> AI 设置 中配置 API Key
        </div>
        <div v-else class="flex items-end gap-2 bg-slate-50 rounded-2xl p-2 border border-slate-200 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <textarea 
            v-model="input"
            @keydown.enter.prevent="sendMessage"
            placeholder="问点什么吧... (Enter发送)"
            class="flex-1 max-h-32 px-3 py-2 bg-transparent focus:outline-none resize-none text-[15px]"
            rows="1"
            style="min-height: 40px;"
            @input="e => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }"
          ></textarea>
          <button 
            @click="sendMessage"
            :disabled="isLoading || !input.trim()"
            class="p-2 mb-1 bg-blue-500 text-white rounded-xl shadow focus:outline-none hover:bg-blue-600 disabled:opacity-50 shrink-0 transition-all flex items-center justify-center"
          >
            <div v-if="isLoading" class="i-solar:spinner-bold animate-spin size-5" />
            <div v-else class="i-solar:plain-bold size-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
