<script setup lang="ts">
import type { AIConfig } from '@/utils/ai-providers'

import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { nanoid } from 'nanoid'
import { computed, nextTick, onMounted, ref } from 'vue'

import { AIService } from '@/utils/ai-providers'

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
async function scrollToBottom() {
  await nextTick()
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
  }
}

function createNewSession() {
  const newSession: ChatSession = {
    id: nanoid(),
    title: '新对话',
    messages: [],
    updatedAt: Date.now(),
  }
  sessions.value.unshift(newSession)
  currentSessionId.value = newSession.id
  saveSessions()
}

function selectSession(id: string) {
  currentSessionId.value = id
  scrollToBottom()
}

function deleteSession(id: string) {
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

function saveSessions() {
  localStorage.setItem('chat_sessions', JSON.stringify(sessions.value))
}

function loadSessions() {
  const saved = localStorage.getItem('chat_sessions')
  if (saved) {
    try {
      sessions.value = JSON.parse(saved)
      if (sessions.value.length > 0) {
        currentSessionId.value = sessions.value[0].id
      } else {
        createNewSession()
      }
    } catch {
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
    baseUrl: (settings.custom_base_url as string) || '',
  }
  if (config.apiKey) {
    aiService.value = new AIService(config)
  }
  assistantConfig.value = {
    name: (settings.custom_assistant_name as string) || '职场喵',
    icon: (settings.custom_assistant_icon as string) || '🐱',
    prompt: (settings.custom_assistant_prompt as string) || '你是一个超级厉害的职场助手，你熟悉所有的编程、营销、策划知识。',
  }
  scrollToBottom()
})

async function sendMessage() {
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
      assistantConfig.value.prompt,
    )
    let fullText = ''
    for await (const chunk of stream) {
      fullText += chunk
      currentSession.value.messages[currentSession.value.messages.length - 1].content = fullText
      scrollToBottom()
    }
  } catch (error) {
    currentSession.value.messages[currentSession.value.messages.length - 1].content = `抱歉，出现了错误：${error}`
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
  <div class="h-screen flex overflow-hidden bg-slate-50 text-slate-800 font-sans">
    <!-- Sidebar -->
    <div class="w-64 flex shrink-0 flex-col select-none border-r border-slate-200 bg-slate-100">
      <div
        class="h-14 flex items-center justify-between border-b border-slate-200 bg-slate-100/50 px-4"
        data-tauri-drag-region
      >
        <div class="pointer-events-none flex items-center gap-2 text-slate-700 font-bold">
          <span class="text-xl">{{ assistantConfig.icon }}</span>
          <span>会话列表</span>
        </div>
        <button
          class="p-1 text-blue-500 hover:text-blue-600"
          title="新对话"
          @click="createNewSession"
        >
          <div class="i-solar:add-circle-bold size-5" />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="group flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors"
          :class="currentSessionId === session.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-200 text-slate-600'"
          @click="selectSession(session.id)"
        >
          <div class="flex-1 truncate pr-2 text-sm font-medium">
            {{ session.title }}
          </div>
          <button
            class="p-1 text-slate-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
            @click.stop="deleteSession(session.id)"
          >
            <div class="i-solar:trash-bin-minimalistic-bold size-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Main Chat Area -->
    <div class="flex flex-1 flex-col bg-white">
      <!-- Titlebar -->
      <div
        class="h-14 flex items-center justify-between border-b border-slate-100 px-4"
        data-tauri-drag-region
      >
        <div class="pointer-events-none flex items-center gap-2 font-bold">
          <span class="text-xl">{{ assistantConfig.icon }}</span>
          <span class="text-slate-800">{{ assistantConfig.name }}</span>
        </div>

        <!-- Window Controls -->
        <div class="flex items-center gap-2">
          <button
            class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            @click.stop="minimizeWindow"
          >
            <div class="i-solar:minimize-square-minimalistic-linear size-4" />
          </button>
          <button
            class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500"
            @click.stop="closeWindow"
          >
            <div class="i-solar:close-square-linear size-4" />
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div
        ref="chatContainerRef"
        class="flex-1 overflow-y-auto p-4 space-y-4"
      >
        <div
          v-if="!currentSession || currentSession.messages.length === 0"
          class="h-full flex flex-col items-center justify-center text-slate-400"
        >
          <div class="mb-4 text-6xl">
            {{ assistantConfig.icon }}
          </div>
          <p>和 {{ assistantConfig.name }} 聊点什么吧...</p>
        </div>
        <template v-else>
          <div
            v-for="(msg, idx) in currentSession.messages"
            :key="idx"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              v-if="msg.role === 'assistant'"
              class="mr-2 shrink-0"
            >
              <div class="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-lg">
                {{ assistantConfig.icon }}
              </div>
            </div>
            <div
              class="max-w-[80%] rounded-2xl px-4 py-2"
              :class="msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-slate-50 text-slate-800 rounded-bl-sm border border-slate-100 shadow-sm'"
            >
              <p
                class="whitespace-pre-wrap break-words text-[15px] leading-relaxed"
                style="word-break: break-all;"
              >
                {{ msg.content }}
              </p>
            </div>
          </div>
        </template>
      </div>

      <!-- Input Area -->
      <div class="border-t border-slate-50 bg-white p-4">
        <div
          v-if="!aiService"
          class="w-full rounded-lg bg-red-50 py-2 text-center text-red-500"
        >
          请先在 设置 -> AI 设置 中配置 API Key
        </div>
        <div
          v-else
          class="flex items-end gap-2 border border-slate-200 rounded-2xl bg-slate-50 p-2 transition-all focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100"
        >
          <textarea
            v-model="input"
            class="max-h-32 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] focus:outline-none"
            placeholder="问点什么吧... (Enter发送)"
            rows="1"
            style="min-height: 40px;"
            @input="e => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }"
            @keydown.enter.prevent="sendMessage"
          />
          <button
            class="mb-1 flex shrink-0 items-center justify-center rounded-xl bg-blue-500 p-2 text-white shadow transition-all hover:bg-blue-600 disabled:opacity-50 focus:outline-none"
            :disabled="isLoading || !input.trim()"
            @click="sendMessage"
          >
            <div
              v-if="isLoading"
              class="i-solar:spinner-bold size-5 animate-spin"
            />
            <div
              v-else
              class="i-solar:plain-bold size-5"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
