import type { Cubism4InternalModel } from 'pixi-live2d-display'

import { convertFileSrc } from '@tauri-apps/api/core'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { Cubism4ModelSettings, Live2DModel } from 'pixi-live2d-display'
import { Application, Ticker } from 'pixi.js'

Live2DModel.registerTicker(Ticker)

const DEFAULT_WIDTH = 400
const DEFAULT_HEIGHT = 300

class Live2DManager {
  private static instance: Live2DManager
  private app: Application | null = null
  public model: Live2DModel | null = null
  private canvas: HTMLCanvasElement | null = null
  private container: HTMLElement | null = null

  private constructor() {}

  static getInstance(): Live2DManager {
    if (!Live2DManager.instance) {
      Live2DManager.instance = new Live2DManager();
    }
    return Live2DManager.instance;
  }

  /** 由 Pixi 自己创建 canvas 并挂到 container，避免传入 React 的 canvas 导致 WebGL checkMaxIfStatementsInShader 报 0 出错（尤其 Windows） */
  private createApp(container: HTMLElement, width: number, height: number) {
    if (this.app) return
    // 使用不透明背景并每帧清除，避免移动时底层重影（透明 + 未清除会残留上一帧）
    this.app = new Application({
      width,
      height,
      backgroundColor: 0xf1f5f9,
      backgroundAlpha: 1,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })
    this.canvas = this.app.view as HTMLCanvasElement
    this.container = container
    container.innerHTML = ''
    container.appendChild(this.canvas)
  }

  /** 统一为用 / 的路径，避免 Windows 反斜杠导致拼接错误 */
  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  public async initialize(container: HTMLElement, modelPath: string, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT): Promise<void> {
    const { loadLive2DScripts } = await import('./load-live2d-scripts');
    await loadLive2DScripts();

    if (this.model) {
      this.destroy();
    }

    this.createApp(container, width, height)

    const basePath = this.normalizePath(modelPath);
    const files = await readDir(basePath);

    const modelFile = files.find(file => file.name.endsWith('.model3.json'));

    if (!modelFile) {
      throw new Error('未找到模型主配置文件 (.model3.json)，请确认模型文件是否完整。');
    }

    const fullPath = basePath + '/' + modelFile.name;
    const modelJSON = JSON.parse(await readTextFile(fullPath));

    const modelSettings = new Cubism4ModelSettings({
      ...modelJSON,
      url: convertFileSrc(fullPath),
    });

    modelSettings.replaceFiles((file) => {
      return convertFileSrc(basePath + '/' + file);
    });

    this.model = await Live2DModel.from(modelSettings);

    this.app?.stage.addChild(this.model);

    this.resizeModel();
    
    window.addEventListener('resize', () => this.resizeModel());
  }

  public resizeModel() {
    if (!this.model || !this.canvas) return;

    const { width, height } = this.model;
    const scaleX = this.canvas.width / width;
    const scaleY = this.canvas.height / height;
    // 留边距确保完整显示，避免头顶/边缘被裁切
    const scale = Math.min(scaleX, scaleY) * 0.88;
    this.model.scale.set(scale);

    // 底部对齐：锚点设脚底中心，放在画布底部，形象完整且不会裁切
    this.model.anchor.set(0.5, 1);
    this.model.x = this.canvas.width / 2;
    this.model.y = this.canvas.height;
  }

  public playMotion(group: string, index: number) {
    return this.model?.motion(group, index);
  }

  public playExpressions(index: number) {
    return this.model?.expression(index);
  }

  public getCoreModel() {
    const internalModel = this.model?.internalModel as Cubism4InternalModel;
    return internalModel?.coreModel;
  }

  public getParameterRange(id: string) {
    const coreModel = this.getCoreModel();
    const index = coreModel?.getParameterIndex(id);
    const min = coreModel?.getParameterMinimumValue(index);
    const max = coreModel?.getParameterMaximumValue(index);

    return {
      min,
      max,
    };
  }

  public setParameterValue(id: string, value: number | boolean) {
    const coreModel = this.getCoreModel();
    return coreModel?.setParameterValueById?.(id, Number(value));
  }

  public getModelInfo(): { motions: string[]; expressions: string[] } | null {
    if (!this.model) return null;

    try {
      const motions = Object.keys(this.model.internalModel.motionManager.motionGroups);
      const expressions = Object.keys(this.model.internalModel.motionManager.definitions);

      return { motions, expressions };
    } catch (error) {
      console.error('Failed to get model info:', error);
      return null;
    }
  }

  public destroy(): void {
    try {
      if (this.model) {
        try {
          this.model.destroy();
        } catch (_) {}
        this.model = null;
      }
    } catch (_) {}

    try {
      if (this.app) {
        try {
          this.app.destroy(true);
        } catch (_) {}
        this.app = null;
      }
    } catch (_) {}
    this.container = null;
    this.canvas = null;

    try {
      window.removeEventListener('resize', () => this.resizeModel());
    } catch (_) {}
  }
}

export default Live2DManager;
