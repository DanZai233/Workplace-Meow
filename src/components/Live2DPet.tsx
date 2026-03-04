import { Component, type ReactNode, useEffect, useRef, useState } from 'react';
import { resolveResource } from '@tauri-apps/api/path';
import { PetState } from '../constants';
import { loadLive2DScripts } from '../utils/load-live2d-scripts';
import { PET_DISPLAY_WIDTH, PET_DISPLAY_HEIGHT } from '../utils/live2d-manager';

interface Live2DPetProps {
  state: PetState;
  /** 模型路径或内置名称（如 elsia、standard），组件内会解析为完整路径 */
  modelPath?: string;
  onDoubleClick?: () => void;
}

async function resolveModelPath(raw: string): Promise<string> {
  const t = raw?.trim();
  if (!t) return t;
  if (t.includes('/') || t.includes('\\')) return t.replace(/\\/g, '/');
  const base = await resolveResource('assets/models');
  return `${base}/${t}`;
}

export function Live2DPet({ state, modelPath, onDoubleClick }: Live2DPetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [usingDefault, setUsingDefault] = useState(!modelPath?.trim());
  const managerRef = useRef<{
    destroy: () => void;
    getModelInfo: () => { motions: string[]; expressions?: string[] } | null;
    playMotion: (g: string, i: number) => unknown;
    trySetParameter: (id: string, value: number) => boolean;
  } | null>(null);

  useEffect(() => {
    if (!modelPath?.trim()) {
      setUsingDefault(true);
      setLoaded(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    setLoaded(false);
    setUsingDefault(false);
    let cancelled = false;
    const run = async () => {
      try {
        const resolved = await resolveModelPath(modelPath!);
        if (cancelled) return;
        await loadLive2DScripts();
        if (cancelled) return;
        const { default: Live2DManager } = await import('../utils/live2d-manager');
        if (cancelled) return;
        const manager = Live2DManager.getInstance();
        managerRef.current = manager;
        await manager.initialize(container, resolved, PET_DISPLAY_WIDTH, PET_DISPLAY_HEIGHT);
        if (cancelled) return;
        setUsingDefault(false);
        setLoaded(true);
      } catch (error) {
        if (cancelled) return;
        console.error('Live2D 加载失败，已回退为默认桌宠:', error);
        setUsingDefault(true);
        setLoaded(true);
      }
    };

    run();
    return () => {
      cancelled = true;
      try {
        managerRef.current?.destroy();
      } catch (_) {}
      managerRef.current = null;
    };
  }, [modelPath]);

  useEffect(() => {
    if (!loaded || usingDefault || !managerRef.current) return;

    const triggerMotion = async () => {
      try {
        const manager = managerRef.current;
        const modelInfo = manager.getModelInfo();
        
        if (!modelInfo) return;

        const motions = modelInfo.motions;
        const findMotion = (names: string[]) => names.find((n) => motions.includes(n));
        switch (state) {
          case 'idle':
            break;
          case 'typing': {
            const name = findMotion(['tap_body', 'tap', 'type', 'speak', '02', '03']);
            if (name != null) await manager.playMotion(name, 0);
            else if (motions.length > 0) await manager.playMotion(motions[0], 0);
            break;
          }
          case 'thinking': {
            const name = findMotion(['flick_head', 'think', '04', '05']);
            if (name != null) await manager.playMotion(name, 0);
            else if (motions.length > 1) await manager.playMotion(motions[0], 1);
            break;
          }
          case 'alert': {
            const name = findMotion(['tap_body', 'listen', 'tap']);
            if (name != null) await manager.playMotion(name, 1);
            break;
          }
        }
      } catch (error) {
        console.error('Failed to trigger motion:', error);
      }
    };

    triggerMotion();
  }, [state, loaded, usingDefault]);

  // idle 时仅做眨眼；不碰呼吸/角度等，避免触发模型里会藏头发的逻辑
  useEffect(() => {
    if (!loaded || usingDefault || state !== 'idle' || !managerRef.current) return;
    const manager = managerRef.current;
    const blinkInterval = window.setInterval(() => {
      manager.trySetParameter('ParamEyeLOpen', 0);
      manager.trySetParameter('ParamEyeROpen', 0);
      setTimeout(() => {
        manager.trySetParameter('ParamEyeLOpen', 1);
        manager.trySetParameter('ParamEyeROpen', 1);
      }, 120 + Math.random() * 80);
    }, 2500 + Math.random() * 2000);
    return () => window.clearInterval(blinkInterval);
  }, [loaded, usingDefault, state]);

  if (usingDefault) {
    return <DefaultPet state={state} onDoubleClick={onDoubleClick} />;
  }

  return (
    <div
      ref={containerRef}
      className="rounded-lg overflow-hidden"
      style={{
        width: PET_DISPLAY_WIDTH,
        height: PET_DISPLAY_HEIGHT,
        cursor: 'pointer',
        background: 'transparent',
        position: 'relative',
        isolation: 'isolate',
      }}
      onDoubleClick={onDoubleClick}
      role="img"
      aria-label="Live2D 桌宠"
    />
  );
}

export function DefaultPet({ state, onDoubleClick }: { state: PetState; onDoubleClick?: () => void }) {
  return (
    <svg
      width={PET_DISPLAY_WIDTH}
      height={PET_DISPLAY_HEIGHT}
      viewBox={`0 0 ${PET_DISPLAY_WIDTH} ${PET_DISPLAY_HEIGHT}`}
      fill="none"
      onDoubleClick={onDoubleClick}
      style={{ cursor: 'pointer' }}
    >
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity={0.15} />
        </filter>
      </defs>
      
      <g filter="url(#shadow)">
        <ellipse cx="200" cy="260" rx="120" ry="30" fill="#e2e8f0" opacity="0.5" />
        
        <path d="M100 200 Q100 80 200 80 Q300 80 300 200" fill="#ffffff" stroke="#1e293b" strokeWidth="4"/>
        
        <path d="M130 80 L145 30 L180 70" fill="#ffffff" stroke="#1e293b" strokeWidth="4" strokeLinejoin="round"/>
        <path d="M270 80 L255 30 L220 70" fill="#ffffff" stroke="#1e293b" strokeWidth="4" strokeLinejoin="round"/>
        
        <path d="M140 50 L148 40 L170 65" fill="#fecdd3" />
        <path d="M260 50 L252 40 L230 65" fill="#fecdd3" />
        
        <circle cx="160" cy="150" r="12" fill="#1e293b"/>
        <circle cx="240" cy="150" r="12" fill="#1e293b"/>
        
        <circle cx="164" cy="146" r="4" fill="#ffffff"/>
        <circle cx="244" cy="146" r="4" fill="#ffffff"/>
        
        <ellipse cx="130" cy="170" rx="12" ry="6" fill="#fecdd3" opacity="0.8"/>
        <ellipse cx="270" cy="170" rx="12" ry="6" fill="#fecdd3" opacity="0.8"/>
        
        {state === 'idle' && (
          <path d="M180 180 Q200 195 220 180" stroke="#1e293b" strokeWidth="4" fill="none" strokeLinecap="round"/>
        )}
        
        {state === 'thinking' && (
          <>
            <ellipse cx="260" cy="110" rx="8" ry="10" fill="#94a3b8" opacity="0.8"/>
            <circle cx="260" cy="100" r="4" fill="#94a3b8" opacity="0.8"/>
            <path d="M200 180 Q200 185 205 190" stroke="#1e293b" strokeWidth="4" fill="none" strokeLinecap="round"/>
          </>
        )}
        
        {state === 'typing' && (
          <circle cx="200" cy="185" r="4" fill="#1e293b"/>
        )}
      </g>
      
      <g transform="translate(100, 180)">
        <animateMotion
          path="M0 0 Q0 -20 0 0"
          dur="0.15s"
          repeatCount={state === 'typing' ? 'indefinite' : '0'}
        >
          <path d="M-40 70 Q-40 35 -15 35 Q10 35 10 70" fill="#ffffff" stroke="#1e293b" strokeWidth="4"/>
        </animateMotion>
      </g>
      
      <g transform="translate(220, 180)">
        {state === 'typing' ? (
          <animateMotion
            path="M0 0 Q0 -20 0 0"
            dur="0.15s"
            repeatCount="indefinite"
          >
            <path d="M-5 70 Q-5 35 20 35 Q45 35 45 70" fill="#ffffff" stroke="#1e293b" strokeWidth="4"/>
          </animateMotion>
        ) : state === 'thinking' ? (
          <g transform="translate(-20, -45) rotate(-15)">
            <path d="M-5 70 Q-5 35 20 35 Q45 35 45 70" fill="#ffffff" stroke="#1e293b" strokeWidth="4"/>
          </g>
        ) : (
          <path d="M-5 70 Q-5 35 20 35 Q45 35 45 70" fill="#ffffff" stroke="#1e293b" strokeWidth="4"/>
        )}
      </g>
    </svg>
  );
}

/** 捕获 Live2D 子树内错误，避免崩溃拖垮整块面板；出错时显示默认桌宠 */
class Live2DErrorBoundary extends Component<
  { children: ReactNode; state: PetState; onDoubleClick?: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Live2D 错误边界捕获:', error);
  }

  render() {
    if (this.state.hasError) {
      return <DefaultPet state={this.props.state} onDoubleClick={this.props.onDoubleClick} />;
    }
    return this.props.children;
  }
}

/** 带错误边界的 Live2D 桌宠，推荐在 App 中使用 */
export function Live2DPetWithBoundary(props: Live2DPetProps) {
  return (
    <Live2DErrorBoundary state={props.state} onDoubleClick={props.onDoubleClick}>
      <Live2DPet {...props} />
    </Live2DErrorBoundary>
  );
}
