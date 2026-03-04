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
        applyCursorToLive2D(manager, xRatio, yRatio, true);
      } catch (_) {}
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

const TYPING_PARAMS = ['CatParamLeftHandDown', 'ParamMouseLeftDown', 'ParamMouseRightDown'] as const;

export function useTypingAnimation() {
  const manager = Live2DManager.getInstance();
  const keyPressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keyReleaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTyping = useCallback(() => {
    try {
      const tick = () => {
        const param = TYPING_PARAMS[Math.floor(Math.random() * TYPING_PARAMS.length)];
        manager.trySetParameter?.(param, 1);
        const releaseMs = 50 + Math.random() * 80;
        keyReleaseRef.current = window.setTimeout(() => {
          manager.trySetParameter?.(param, 0);
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
      for (const p of TYPING_PARAMS) {
        manager.trySetParameter?.(p, 0);
      }
      manager.trySetParameter?.('ParamMouthOpenY', 0);
    } catch (_) {}
  }, []);

  return { startTyping, stopTyping };
}
