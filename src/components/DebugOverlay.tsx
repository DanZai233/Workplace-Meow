import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { debugLog, type DebugEntry } from '../utils/debug-log';

export function DebugOverlay() {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [devtoolsOk, setDevtoolsOk] = useState(true);

  useEffect(() => {
    const refresh = () => setEntries(debugLog.getEntries());
    refresh();
    return debugLog.subscribe(refresh);
  }, []);

  const openDevtools = async () => {
    try {
      await invoke('open_devtools', { label: 'main' });
    } catch (e) {
      setDevtoolsOk(false);
      debugLog.add('error', '打开控制台失败', String(e));
    }
  };

  if (entries.length === 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-2 py-1 bg-slate-800 text-slate-200 text-xs font-mono">
        <span>职场桌宠 · 调试栏（无错误时也显示，便于排查“看不见”问题）</span>
        <button
          type="button"
          onClick={openDevtools}
          className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500"
        >
          打开控制台 (DevTools)
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] font-mono text-xs bg-slate-900 text-slate-200 border-b border-slate-600">
      <div className="flex items-center justify-between px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-left flex-1"
        >
          <span className="text-red-400 font-semibold">
            共 {entries.length} 条错误/警告 · 点击{open ? '收起' : '展开'}
          </span>
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={openDevtools}
            className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500"
          >
            打开控制台
          </button>
          {!devtoolsOk && <span className="text-red-400">(打开失败)</span>}
        </div>
      </div>
      {open && (
        <div className="max-h-48 overflow-y-auto px-2 pb-2 space-y-1 border-t border-slate-700 pt-1">
          {entries.slice().reverse().map((e) => (
            <div key={e.id} className="bg-slate-800 rounded px-2 py-1">
              <span className="text-slate-400">{e.time}</span>{' '}
              <span className={e.type === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                [{e.type}]
              </span>{' '}
              {e.message}
              {e.detail && (
                <div className="text-slate-500 mt-0.5 whitespace-pre-wrap break-all">
                  {e.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
