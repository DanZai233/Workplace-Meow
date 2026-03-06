/**
 * 动态加载 Live2D Cubism 运行时脚本，仅在首次使用 Live2D 时调用。
 * 避免在 index.html 中同步加载导致启动时崩溃拖垮整页（尤其 Windows）。
 */
const SCRIPTS = ['/js/live2dcubismcore.min.js', '/js/live2d.min.js'];
let loadPromise: Promise<void> | null = null;

export function loadLive2DScripts(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    for (const src of SCRIPTS) {
      if (document.querySelector(`script[src="${src}"]`)) continue;
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      });
    }
  })();
  return loadPromise;
}
