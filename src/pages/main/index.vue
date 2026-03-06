<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { PhysicalSize } from '@tauri-apps/api/dpi'
import { Menu } from '@tauri-apps/api/menu'
import { sep } from '@tauri-apps/api/path'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { exists, readDir } from '@tauri-apps/plugin-fs'
import { useDebounceFn, useEventListener } from '@vueuse/core'
import { round } from 'es-toolkit'
import { nth } from 'es-toolkit/compat'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { useDevice } from '@/composables/useDevice'
import { useGamepad } from '@/composables/useGamepad'
import { useModel } from '@/composables/useModel'
import { useSharedMenu } from '@/composables/useSharedMenu'
import { useWindowPosition } from '@/composables/useWindowPosition'
import { hideWindow, setAlwaysOnTop, setTaskbarVisibility, showWindow } from '@/plugins/window'
import { useCatStore } from '@/stores/cat'
import { useGeneralStore } from '@/stores/general.ts'
import { useModelStore } from '@/stores/model'
import { isImage } from '@/utils/is'
import { join } from '@/utils/path'
import { clearObject } from '@/utils/shared'
import { useSystemMonitor } from '@/composables/useSystemMonitor'
import { useActivityMonitoring } from '@/composables/useActivityMonitoring'
import { useChatReaction } from '@/composables/useChatReaction'

const { clipboardText, showClipboardAlert, handleClipboardAlert, showPomodoroAlert, handlePomodoroAlert, workDuration, formatDuration } = useSystemMonitor()
const { currentActivity, showActivityBubble, showEncouragementBubble, encouragementMessage } = useActivityMonitoring()
const { showCareBubble, careBubbleText } = useChatReaction()

const { startListening } = useDevice()
const appWindow = getCurrentWebviewWindow()
const { modelSize, handleLoad, handleDestroy, handleResize, handleKeyChange } = useModel()
const catStore = useCatStore()
const { getSharedMenu } = useSharedMenu()
const modelStore = useModelStore()
const generalStore = useGeneralStore()
const resizing = ref(false)
const backgroundImagePath = ref<string>()
const { stickActive } = useGamepad()
const { isMounted, setWindowPosition } = useWindowPosition()

onMounted(startListening)

onUnmounted(handleDestroy)

const debouncedResize = useDebounceFn(async () => {
  await handleResize()

  await setWindowPosition()

  resizing.value = false
}, 100)

useEventListener('resize', () => {
  resizing.value = true

  debouncedResize()
})

watch(() => modelStore.currentModel, async (model) => {
  if (!model) return

  await handleLoad()

  const path = join(model.path, 'resources', 'background.png')

  const existed = await exists(path)

  backgroundImagePath.value = existed ? convertFileSrc(path) : void 0

  clearObject([modelStore.supportKeys, modelStore.pressedKeys])

  const resourcePath = join(model.path, 'resources')
  const groups = ['left-keys', 'right-keys']

  for await (const groupName of groups) {
    const groupDir = join(resourcePath, groupName)
    const files = await readDir(groupDir).catch(() => [])
    const imageFiles = files.filter(file => isImage(file.name))

    for (const file of imageFiles) {
      const fileName = file.name.split('.')[0]

      modelStore.supportKeys[fileName] = join(groupDir, file.name)
    }
  }

  setWindowPosition()
}, { deep: true, immediate: true })

watch([() => catStore.window.scale, modelSize], async ([scale, modelSize]) => {
  if (!modelSize) return

  const { width, height } = modelSize

  appWindow.setSize(
    new PhysicalSize({
      width: Math.round(width * (scale / 100)),
      height: Math.round(height * (scale / 100)),
    }),
  )
}, { immediate: true })

watch([modelStore.pressedKeys, stickActive], ([keys, stickActive]) => {
  const dirs = Object.values(keys).map((path) => {
    return nth(path.split(sep()), -2)!
  })

  const hasLeft = dirs.some(dir => dir.startsWith('left'))
  const hasRight = dirs.some(dir => dir.startsWith('right'))

  handleKeyChange(true, stickActive.left || hasLeft)
  handleKeyChange(false, stickActive.right || hasRight)
}, { deep: true })

watch(() => catStore.window.visible, async (value) => {
  value ? showWindow() : hideWindow()
})

watch(() => catStore.window.passThrough, (value) => {
  appWindow.setIgnoreCursorEvents(value)
}, { immediate: true })

watch(() => catStore.window.alwaysOnTop, setAlwaysOnTop, { immediate: true })

watch(() => generalStore.app.taskbarVisible, setTaskbarVisibility, { immediate: true })

function handleMouseDown() {
  appWindow.startDragging()
}

async function handleContextmenu(event: MouseEvent) {
  event.preventDefault()

  if (event.shiftKey) return

  const menu = await Menu.new({
    items: await getSharedMenu(),
  })

  menu.popup()
}

function handleMouseMove(event: MouseEvent) {
  const { buttons, shiftKey, movementX, movementY } = event

  if (buttons !== 2 || !shiftKey) return

  const delta = (movementX + movementY) * 0.5
  const nextScale = Math.max(10, Math.min(catStore.window.scale + delta, 500))

  catStore.window.scale = round(nextScale)
}
</script>

<template>
  <div
    v-show="isMounted"
    class="relative size-screen overflow-hidden children:(absolute size-full)"
    :class="{ '-scale-x-100': catStore.model.mirror }"
    :style="{
      opacity: catStore.window.opacity / 100,
      borderRadius: `${catStore.window.radius}%`,
    }"
    @contextmenu="handleContextmenu"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
  >
    <img
      v-if="backgroundImagePath"
      class="object-cover"
      :src="backgroundImagePath"
    >

    <canvas id="live2dCanvas" />

    <img
      v-for="path in modelStore.pressedKeys"
      :key="path"
      class="object-cover"
      :src="convertFileSrc(path)"
    >

    <div
      v-show="resizing"
      class="flex items-center justify-center bg-black"
    >
      <span class="text-center text-[10vw] text-white">
        {{ $t('pages.main.hints.redrawing') }}
      </span>
    </div>

    <!-- WorkplaceMeow Extra Features Bubbles -->
    <div
      v-if="showClipboardAlert || showPomodoroAlert || showActivityBubble || showEncouragementBubble || showCareBubble"
      class="absolute bottom-8 right-8 z-50 bg-white/90 backdrop-blur text-slate-800 px-4 py-3 rounded-2xl shadow-xl border border-slate-200 max-w-[280px] text-sm font-medium pointer-events-auto"
    >
      <div v-if="showClipboardAlert">
        <p class="mb-2 line-clamp-2">📋 剪贴板监听: {{ clipboardText }}</p>
        <button v-if="clipboardText !== '生成中...'" @click.stop="handleClipboardAlert(true)" class="mr-2 px-2 py-1 bg-pink-50 text-pink-500 rounded hover:bg-pink-100">高情商回复</button>
        <button v-if="clipboardText !== '生成中...'" @click.stop="handleClipboardAlert(false)" class="px-2 py-1 text-gray-500 rounded hover:bg-gray-100">忽略</button>
      </div>
      <div v-else-if="showPomodoroAlert" class="flex flex-col gap-2">
        <p>⏰ 已经连续工作 {{ formatDuration(workDuration) }}了，休息一下吧！</p>
        <button @click.stop="handlePomodoroAlert()" class="px-3 py-1.5 bg-blue-500 text-white rounded text-xs mx-auto">我休息好了 / 重置番茄钟</button>
      </div>
      <div v-else-if="showEncouragementBubble">
        <p>✨ {{ encouragementMessage }}</p>
      </div>
      <div v-else-if="showActivityBubble">
        <p>👀 侦测到你正在：{{ currentActivity }}</p>
        <p class="text-xs text-slate-400 mt-1">我可以帮你什么吗？</p>
      </div>
      <div v-else-if="showCareBubble">
        <p>🐱 {{ careBubbleText }}</p>
      </div>
      <div class="absolute top-full right-8 border-[6px] border-transparent border-t-white/90 drop-shadow-sm"></div>
    </div>
  </div>
</template>
