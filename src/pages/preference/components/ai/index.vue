<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
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

const currentProviderData = () => AI_PROVIDERS.find(p => p.id === aiProvider.value)

const onProviderChange = (e: Event) => {
  const provider = (e.target as HTMLSelectElement).value
  aiProvider.value = provider
  const providerData = AI_PROVIDERS.find(p => p.id === provider)
  if (providerData && providerData.models.length > 0) {
    modelName.value = providerData.models[0]
  }
  customBaseUrl.value = providerData?.baseUrl || ''
}

const saveSettings = async () => {
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
      }
    })
    alert('保存成功')
  } catch (error) {
    alert('保存失败: ' + error)
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
      <h3 class="text-lg font-bold">AI 大模型设置</h3>
      
      <div class="flex flex-col gap-2">
        <label class="font-bold">提供商</label>
        <select 
          v-model="aiProvider" 
          @change="onProviderChange"
          class="w-full bg-color-4 border border-color-5 rounded px-3 py-2 text-color-1"
        >
          <option v-for="provider in AI_PROVIDERS" :key="provider.id" :value="provider.id">
            {{ provider.name }}
          </option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-bold">API Key</label>
        <input 
          v-model="apiKey" 
          type="password" 
          placeholder="sk-..." 
          class="w-full bg-color-4 border border-color-5 rounded px-3 py-2 text-color-1"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-bold">模型名称</label>
        <select 
          v-model="modelName" 
          class="w-full bg-color-4 border border-color-5 rounded px-3 py-2 text-color-1"
        >
          <option v-for="model in currentProviderData()?.models || []" :key="model" :value="model">
            {{ model }}
          </option>
          <option value="custom">自定义 (不支持时请修改文件)</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-bold">代理地址 / Base URL (可选)</label>
        <input 
          v-model="customBaseUrl" 
          type="text" 
          placeholder="例如 https://api.openai.com/v1" 
          class="w-full bg-color-4 border border-color-5 rounded px-3 py-2 text-color-1"
        />
      </div>
    </div>

    <!-- Assistant Settings Section -->
    <div class="flex flex-col gap-4 mt-4 pt-4 border-t border-color-5">
      <h3 class="text-lg font-bold">自定义助手设置</h3>
      
      <div class="flex flex-col gap-2">
        <label class="font-bold">助手名称</label>
        <input 
          v-model="customAssistantName" 
          type="text" 
          placeholder="例如：职场喵" 
          class="w-full bg-color-4 border border-color-5 rounded px-3 py-2 text-color-1"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-bold">助手图标 (Emoji)</label>
        <input 
          v-model="customAssistantIcon" 
          type="text" 
          placeholder="例如：🐱" 
          class="w-full bg-color-4 border border-color-5 rounded px-3 py-2 text-color-1"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="font-bold">系统提示词 (System Prompt)</label>
        <textarea 
          v-model="customAssistantPrompt" 
          rows="4" 
          placeholder="定义助手的角色和行为..." 
          class="w-full bg-color-4 border border-color-5 rounded px-3 py-2 text-color-1 resize-y"
        ></textarea>
      </div>
    </div>

    <button 
      @click="saveSettings" 
      class="mt-4 bg-primary-6 hover:bg-primary-5 text-white font-bold py-2 px-4 rounded transition-colors"
      :disabled="saving"
    >
      {{ saving ? '保存中...' : '保存设置' }}
    </button>
  </div>
</template>
