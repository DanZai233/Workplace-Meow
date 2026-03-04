import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import Live2DManager from '../utils/live2d-manager';

export interface CursorPoint {
  x: number;
  y: number;
}

function applyCursorToLive2D(manager: Live2DManager, xRatio: number, yRatio: number) {
  try {
    for (const id of ['ParamMouseX', 'ParamMouseY', 'ParamAngleX', 'ParamAngleY']) {
      const range = manager.getParameterRange?.(id);
      if (!range || range.min === undefined || range.max === undefined) continue;
      const isXAxis = id.endsWith('X');
      const ratio = isXAxis ? xRatio : yRatio;
      let value = range.max - (ratio * (range.max - range.min));
      if (isXAxis) value = -value;
      manager.setParameterValue(id, value);
    }
  } catch (_) {}
}

/** 仅窗体内部鼠标移动时跟随（旧行为） */
export function useMouseTracking() {
  const manager = Live2DManager.getInstance();
  const appWindow = getCurrentWebviewWindow();

  const handleMouseMove = useCallback(async (event: MouseEvent) => {
    try {
      const scaleFactor = await appWindow.scaleFactor();
      const size = await appWindow.innerSize();
      const xRatio = (event.clientX * scaleFactor) / size.width;
      const yRatio = (event.clientY * scaleFactor) / size.height;
      applyCursorToLive2D(manager, xRatio, yRatio);
    } catch (_) {}
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);
}

/** 全屏鼠标跟随：轮询全局光标位置，使助手视线跟随屏幕上的鼠标 */
export function useGlobalMouseFollow() {
  const manager = Live2DManager.getInstance();
  const appWindow = getCurrentWebviewWindow();

  useEffect(() => {
    let raf = 0;
    const tick = async () => {
      try {
        const [cursor, pos, size, scaleFactor] = await Promise.all([
          invoke<[number, number]>('get_global_cursor_position'),
          invoke<[number, number]>('get_window_position'),
          appWindow.innerSize(),
          appWindow.scaleFactor(),
        ]);
        const [gx, gy] = cursor;
        const [wx, wy] = pos;
        const physW = size.width * scaleFactor;
        const physH = size.height * scaleFactor;
        const relX = (gx - wx) / physW;
        const relY = (gy - wy) / physH;
        const xRatio = Math.max(0, Math.min(1, relX));
        const yRatio = Math.max(0, Math.min(1, relY));
        applyCursorToLive2D(manager, xRatio, yRatio);
      } catch (_) {}
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export function useTypingAnimation() {
  const manager = Live2DManager.getInstance();

  const startTyping = useCallback(() => {
    try {
      const modelInfo = manager.getModelInfo?.();
      if (!modelInfo) return;
      const name = (m: string) => m.toLowerCase();
      const speakingMotion = modelInfo.motions.find(m =>
        name(m).includes('talk') || name(m).includes('speak') || name(m).includes('mouth') ||
        name(m).includes('type') || name(m).includes('tap_body') || name(m).includes('tap')
      );
      if (speakingMotion) {
        manager.playMotion(speakingMotion, 0);
      } else {
        manager.setParameterValue('ParamMouthOpen', 0.8);
      }
    } catch (_) {}
  }, []);

  const stopTyping = useCallback(() => {
    try {
      manager.setParameterValue('ParamMouthOpen', 0);
    } catch (error) {
      console.error('Failed to stop typing animation:', error);
    }
  }, []);

  return { startTyping, stopTyping };
}
