<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { AI_PROVIDERS } from '@/utils/ai-providers'

const aiProvider = ref('gemini')
const apiKey = ref('')
const modelName = ref('gemini-2.5-pro')
const saveStatus = ref('')

onMounted(async () => {
  const settings = (await invoke<Record<string, any>>('get_settings').catch(() => ({}))) as Record<string, any>
  if (settings.ai_provider) aiProvider.value = settings.ai_provider
  if (settings.api_key) apiKey.value = settings.api_key
  if (settings.model_name) modelName.value = settings.model_name
})

const onProviderChange = () => {
  const provider = AI_PROVIDERS.find(p => p.id === aiProvider.value)
  if (provider && provider.models.length > 0) {
    modelName.value = provider.models[0]
  }
}

const saveSettings = async () => {
  saveStatus.value = '保存中...'
  try {
    await invoke('save_settings', {
      settings: {
        ai_provider: aiProvider.value,
        api_key: apiKey.value,
        model_name: modelName.value
      }
    })
    saveStatus.value = '保存成功！'
    setTimeout(() => saveStatus.value = '', 3000)
  } catch (error) {
    saveStatus.value = '保存失败: ' + error
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 p-4">
    <h1 class="text-xl font-bold dark:text-white">AI 智能设置</h1>
    
    <div class="flex flex-col gap-2">
      <label class="font-medium dark:text-gray-200">AI 提供商</label>
      <select v-model="aiProvider" @change="onProviderChange" class="p-2 border rounded-lg bg-transparent dark:text-white dark:border-gray-600">
        <option v-for="provider in AI_PROVIDERS" :key="provider.id" :value="provider.id" class="dark:bg-slate-800">
          {{ provider.name }}
        </option>
      </select>
    </div>

    <div class="flex flex-col gap-2">
      <label class="font-medium dark:text-gray-200">模型</label>
      <select v-model="modelName" class="p-2 border rounded-lg bg-transparent dark:text-white dark:border-gray-600">
        <option v-for="model in AI_PROVIDERS.find(p => p.id === aiProvider)?.models || []" :key="model" :value="model" class="dark:bg-slate-800">
          {{ model }}
        </option>
      </select>
    </div>

    <div class="flex flex-col gap-2">
      <label class="font-medium dark:text-gray-200">API 密钥 (API Key)</label>
      <input type="password" v-model="apiKey" placeholder="输入你的 API Key" class="p-2 border rounded-lg bg-transparent dark:text-white dark:border-gray-600" />
      <p class="text-xs text-slate-500">API Key 保存在本地计算机，不会上传至任何服务器。</p>
    </div>

    <div class="flex items-center gap-4 mt-4">
      <button @click="saveSettings" class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">保存设置</button>
      <span v-if="saveStatus" :class="saveStatus.includes('失败') ? 'text-red-500' : 'text-green-500'">{{ saveStatus }}</span>
    </div>
  </div>
</template>
