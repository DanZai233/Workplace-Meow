<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { message } from 'ant-design-vue'
import { onMounted, ref } from 'vue'

import { AI_PROVIDERS } from '@/utils/ai-providers'

const aiProvider = ref('gemini')
const apiKey = ref('')
const modelName = ref('gemini-2.5-pro')
const customBaseUrl = ref('')
const saving = ref(false)

const customAssistantName = ref('职场喵')
const customAssistantIcon = ref('🐱')
const customAssistantPrompt = ref('你是一个超级厉害的职场助手，你熟悉所有的编程、营销、策划知识。')

onMounted(async () => {
  try {
    const settings = (await invoke<Record<string, any>>('get_settings').catch(() => ({}))) as Record<string, any>
    aiProvider.value = settings.ai_provider || 'gemini'
    apiKey.value = settings.api_key || ''
    modelName.value = settings.model_name || 'gemini-2.5-pro'
    customBaseUrl.value = settings.custom_base_url || ''
    customAssistantName.value = settings.custom_assistant_name || '职场喵'
    customAssistantIcon.value = settings.custom_assistant_icon || '🐱'
    customAssistantPrompt.value = settings.custom_assistant_prompt || '你是一个超级厉害的职场助手，你熟悉所有的编程、营销、策划知识。'
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
})

function onProviderChange(e: Event) {
  const provider = (e.target as HTMLSelectElement).value
  aiProvider.value = provider
  const providerData = AI_PROVIDERS.find(p => p.id === provider)
  customBaseUrl.value = providerData?.baseUrl || ''
}

async function saveSettings() {
  if (saving.value) return
  saving.value = true
  try {
    const currentSettings = await invoke<Record<string, any>>('get_settings').catch(() => ({}))
    await invoke('save_settings', {
      settings: {
        ...currentSettings,
        ai_provider: aiProvider.value,
        api_key: apiKey.value,
        model_name: modelName.value,
        custom_base_url: customBaseUrl.value,
        custom_assistant_name: customAssistantName.value,
        custom_assistant_icon: customAssistantIcon.value,
        custom_assistant_prompt: customAssistantPrompt.value,
      },
    })
    message.success('保存成功')
  } catch (error) {
    message.error(`保存失败: ${error}`)
    console.error(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 p-4">
    <!-- AI Settings Section -->
    <div class="flex flex-col gap-4">
      <h3 class="text-lg font-bold">
        AI 大模型设置
      </h3>

      <div class="flex flex-col gap-2">
        <label class="font-bold">提供商</label>
        <select
          v-model="aiProvider"
          class="w-full border border-slate-300 rounded bg-white px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          @change="onProviderChange"
        >
          <option
            v-for="provider in AI_PROVIDERS"
            :key="provider.id"
            :value="provider.id"
          >
            {{ provider.name }}
          </option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-bold">API Key</label>
        <input
          v-model="apiKey"
          class="w-full border border-slate-300 rounded bg-white px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="sk-..."
          type="password"
        >
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-bold">模型名称</label>
        <input
          v-model="modelName"
          class="w-full border border-slate-300 rounded bg-white px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="例如 gemini-2.5-pro"
          type="text"
        >
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-bold">代理地址 / Base URL (可选)</label>
        <input
          v-model="customBaseUrl"
          class="w-full border border-slate-300 rounded bg-white px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="例如 https://api.openai.com/v1"
          type="text"
        >
      </div>
    </div>

    <!-- Assistant Settings Section -->
    <div class="mt-4 flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-slate-700">
      <h3 class="text-lg font-bold">
        自定义助手设置
      </h3>

      <div class="flex flex-col gap-2">
        <label class="font-bold">助手名称</label>
        <input
          v-model="customAssistantName"
          class="w-full border border-slate-300 rounded bg-white px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="例如：职场喵"
          type="text"
        >
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-bold">助手图标 (Emoji)</label>
        <input
          v-model="customAssistantIcon"
          class="w-full border border-slate-300 rounded bg-white px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="例如：🐱"
          type="text"
        >
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-bold">系统提示词 (System Prompt)</label>
        <textarea
          v-model="customAssistantPrompt"
          class="w-full resize-y border border-slate-300 rounded bg-white px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          placeholder="定义助手的角色和行为..."
          rows="4"
        />
      </div>
    </div>

    <button
      class="mt-4 rounded bg-primary-6 hover:bg-primary-5 px-4 py-2 text-white font-bold transition-colors"
      :disabled="saving"
      @click="saveSettings"
    >
      {{ saving ? '保存中...' : '保存设置' }}
    </button>
  </div>
</template>
