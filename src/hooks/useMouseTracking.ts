import { useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import Live2DManager from '../utils/live2d-manager';

export interface CursorPoint {
  x: number;
  y: number;
}

function applyCursorToLive2D(manager: Live2DManager, xRatio: number, yRatio: number, clampAngle = false) {
  try {
    const ANGLE_SAFE_MIN = 0.35;
    const ANGLE_SAFE_MAX = 0.65;
    for (const id of ['ParamMouseX', 'ParamMouseY', 'ParamAngleX', 'ParamAngleY']) {
      const range = manager.getParameterRange?.(id);
      if (!range || range.min === undefined || range.max === undefined) continue;
      const isXAxis = id.endsWith('X');
      const ratio = isXAxis ? xRatio : yRatio;
      let value = range.max - (ratio * (range.max - range.min));
      if (isXAxis) value = -value;
      if (clampAngle && (id === 'ParamAngleX' || id === 'ParamAngleY')) {
        const span = (range.max - range.min) || 1;
        const t = (value - range.min) / span;
        const tClamped = ANGLE_SAFE_MIN + t * (ANGLE_SAFE_MAX - ANGLE_SAFE_MIN);
        value = range.min + tClamped * span;
      }
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

/** 全屏鼠标跟随：轮询全局光标位置，使助手视线跟随屏幕上的鼠标。打字中（skipWhenTyping=true）时不更新，让“随机键位”可见 */
export function useGlobalMouseFollow(skipWhenTyping = false) {
  const manager = Live2DManager.getInstance();
  const appWindow = getCurrentWebviewWindow();

  useEffect(() => {
    let raf = 0;
    const tick = async () => {
      if (skipWhenTyping) {
        raf = requestAnimationFrame(tick);
        return;
      }
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
        applyCursorToLive2D(manager, xRatio, yRatio, true);
      } catch (_) {}
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [skipWhenTyping]);
}

// 模拟键盘区域：每次敲键前随机一个“键位”（ParamMouseX/Y 驱动手/视线落点），再按下键盘
const KEY_ZONE_MIN = 0.25;
const KEY_ZONE_MAX = 0.75;

export function useTypingAnimation() {
  const manager = Live2DManager.getInstance();
  const keyPressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keyReleaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTyping = useCallback(() => {
    try {
      const tick = () => {
        // 随机一个键位（不同按键位置），再按下
        const rangeX = manager.getParameterRange?.('ParamMouseX');
        const rangeY = manager.getParameterRange?.('ParamMouseY');
        if (rangeX && rangeY && rangeX.min != null && rangeX.max != null && rangeY.min != null && rangeY.max != null) {
          const spanX = rangeX.max - rangeX.min;
          const spanY = rangeY.max - rangeY.min;
          const t = KEY_ZONE_MIN + Math.random() * (KEY_ZONE_MAX - KEY_ZONE_MIN);
          const u = KEY_ZONE_MIN + Math.random() * (KEY_ZONE_MAX - KEY_ZONE_MIN);
          manager.setParameterValue('ParamMouseX', rangeX.min + t * spanX);
          manager.setParameterValue('ParamMouseY', rangeY.min + u * spanY);
        }
        manager.trySetParameter?.('CatParamLeftHandDown', 1);
        const releaseMs = 50 + Math.random() * 80;
        keyReleaseRef.current = window.setTimeout(() => {
          manager.trySetParameter?.('CatParamLeftHandDown', 0);
          keyReleaseRef.current = null;
        }, releaseMs);
      };
      tick();
      const intervalMs = 80 + Math.random() * 120;
      keyPressTimerRef.current = window.setInterval(tick, intervalMs);

      const modelInfo = manager.getModelInfo?.();
      if (modelInfo) {
        const name = (m: string) => m.toLowerCase();
        const speakingMotion = modelInfo.motions.find(m =>
          name(m).includes('talk') || name(m).includes('speak') || name(m).includes('mouth') ||
          name(m).includes('type') || name(m).includes('tap_body') || name(m).includes('tap')
        );
        if (speakingMotion) {
          manager.playMotion(speakingMotion, 0);
        } else {
          manager.trySetParameter?.('ParamMouthOpenY', 0.8);
        }
      }
    } catch (_) {}
  }, []);

  const stopTyping = useCallback(() => {
    try {
      if (keyPressTimerRef.current) {
        clearInterval(keyPressTimerRef.current);
        keyPressTimerRef.current = null;
      }
      if (keyReleaseRef.current) {
        clearTimeout(keyReleaseRef.current);
        keyReleaseRef.current = null;
      }
      manager.trySetParameter?.('CatParamLeftHandDown', 0);
      manager.trySetParameter?.('ParamMouthOpenY', 0);
    } catch (_) {}
  }, []);

  return { startTyping, stopTyping };
}
