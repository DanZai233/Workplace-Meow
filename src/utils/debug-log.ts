/**
 * 全局调试日志，供界面显示错误与打开控制台
 */
export interface DebugEntry {
  id: number;
  time: string;
  type: 'error' | 'warn' | 'info';
  message: string;
  detail?: string;
}

let nextId = 0;
const entries: DebugEntry[] = [];
const maxEntries = 50;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => cb());
}

export const debugLog = {
  add(type: DebugEntry['type'], message: string, detail?: string) {
    entries.push({
      id: ++nextId,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      type,
      message,
      detail,
    });
    if (entries.length > maxEntries) entries.shift();
    emit();
  },
  getEntries(): DebugEntry[] {
    return [...entries];
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  clear() {
    entries.length = 0;
    emit();
  },
};

/** 安装全局错误与未处理 Promise 捕获，写入 debugLog */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    debugLog.add(
      'error',
      event.message || String(event),
      [event.filename, event.lineno, event.colno].filter(Boolean).join(':')
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message ?? event.reason ?? String(event);
    debugLog.add('error', `Unhandled promise: ${msg}`, event.reason?.stack);
  });
}
