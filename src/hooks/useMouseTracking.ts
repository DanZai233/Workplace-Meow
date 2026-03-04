import { useEffect, useCallback } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import Live2DManager from '../utils/live2d-manager';

export interface CursorPoint {
  x: number;
  y: number;
}

export function useMouseTracking() {
  const manager = Live2DManager.getInstance();
  const appWindow = getCurrentWebviewWindow();

  const handleMouseMove = useCallback(async (event: MouseEvent) => {
    try {
      const { clientX, clientY } = event;
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      
      const scaleFactor = await appWindow.scaleFactor();
      const size = await appWindow.innerSize();
      
      const xRatio = (clientX * scaleFactor) / size.width;
      const yRatio = (clientY * scaleFactor) / size.height;

      for (const id of ['ParamMouseX', 'ParamMouseY', 'ParamAngleX', 'ParamAngleY']) {
        const range = manager.getParameterRange?.(id);
        
        if (!range || range.min === undefined || range.max === undefined) continue;
        
        const isXAxis = id.endsWith('X');
        const ratio = isXAxis ? xRatio : yRatio;
        let value = range.max - (ratio * (range.max - range.min));

        if (isXAxis) {
          value = -value; // 水平方向反转
        }

        manager.setParameterValue(id, value);
      }
    } catch (error) {
      console.error('Failed to handle mouse move:', error);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);
}

export function useTypingAnimation() {
  const manager = Live2DManager.getInstance();

  const startTyping = useCallback(() => {
    try {
      const modelInfo = manager.getModelInfo?.();
      
      if (!modelInfo) return;

      const typingMotion = modelInfo.motions.find(m => 
        m.toLowerCase().includes('type') || 
        m.toLowerCase().includes('tap_body') ||
        m.toLowerCase().includes('tap')
      );

      if (typingMotion) {
        manager.playMotion(typingMotion, 0);
      } else {
        manager.setParameterValue('ParamMouthOpen', 0.8);
      }
    } catch (error) {
      console.error('Failed to start typing animation:', error);
    }
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
