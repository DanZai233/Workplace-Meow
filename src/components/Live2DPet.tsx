import { useEffect, useRef, useState } from 'react';
import { PetState } from '../constants';
import Live2DManager from '../utils/live2d-manager';

interface Live2DPetProps {
  state: PetState;
  modelPath?: string;
  onDoubleClick?: () => void;
}

export function Live2DPet({ state, modelPath, onDoubleClick }: Live2DPetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [usingDefault, setUsingDefault] = useState(!modelPath);
  const managerRef = useRef<Live2DManager | null>(null);

  useEffect(() => {
    if (usingDefault) {
      setLoaded(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !modelPath) return;

    const loadLive2D = async () => {
      try {
        const manager = Live2DManager.getInstance();
        managerRef.current = manager;
        
        await manager.initialize(canvas, modelPath);
        setLoaded(true);
      } catch (error) {
        console.error('Failed to load Live2D model:', error);
        setUsingDefault(true);
        setLoaded(true);
      }
    };

    loadLive2D();

    return () => {
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, [modelPath, usingDefault]);

  useEffect(() => {
    if (!loaded || usingDefault || !managerRef.current) return;

    const triggerMotion = async () => {
      try {
        const manager = managerRef.current;
        const modelInfo = manager.getModelInfo();
        
        if (!modelInfo) return;

        switch (state) {
          case 'idle':
            if (modelInfo.motions.includes('idle')) {
              await manager.playMotion('idle', 0);
            }
            break;
          case 'typing':
            if (modelInfo.motions.includes('tap_body')) {
              await manager.playMotion('tap_body', 0);
            } else if (modelInfo.motions.length > 0) {
              await manager.playMotion(modelInfo.motions[0], 0);
            }
            break;
          case 'thinking':
            if (modelInfo.motions.includes('flick_head')) {
              await manager.playMotion('flick_head', 0);
            } else if (modelInfo.motions.length > 1) {
              await manager.playMotion(modelInfo.motions[0], 1);
            }
            break;
          case 'listening':
            if (modelInfo.motions.includes('tap_body')) {
              await manager.playMotion('tap_body', 1);
            }
            break;
        }
      } catch (error) {
        console.error('Failed to trigger motion:', error);
      }
    };

    triggerMotion();
  }, [state, loaded, usingDefault]);

  if (usingDefault) {
    return <DefaultPet state={state} onDoubleClick={onDoubleClick} />;
  }

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={300}
      onDoubleClick={onDoubleClick}
      style={{ cursor: 'pointer' }}
    />
  );
}

function DefaultPet({ state, onDoubleClick }: { state: PetState; onDoubleClick?: () => void }) {
  return (
    <svg
      width="400"
      height="300"
      viewBox="0 0 400 300"
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
