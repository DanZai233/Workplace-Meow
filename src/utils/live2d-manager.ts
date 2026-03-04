import type { Cubism4InternalModel } from 'pixi-live2d-display'

import { convertFileSrc } from '@tauri-apps/api/core'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { Cubism4ModelSettings, Live2DModel } from 'pixi-live2d-display'
import { Application, Ticker } from 'pixi.js'

Live2DModel.registerTicker(Ticker)

export const PET_DISPLAY_WIDTH = 480
export const PET_DISPLAY_HEIGHT = 400
const DEFAULT_WIDTH = PET_DISPLAY_WIDTH
const DEFAULT_HEIGHT = PET_DISPLAY_HEIGHT

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

  /** 由 Pixi 自己创建 canvas 并挂到 container；透明背景与窗口一致 */
  private createApp(container: HTMLElement, width: number, height: number) {
    if (this.app) return
    this.app = new Application({
      width,
      height,
      backgroundAlpha: 0,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })
    this.canvas = this.app.view as HTMLCanvasElement
    this.container = container
    container.innerHTML = ''
    this.canvas.style.display = 'block'
    this.canvas.style.position = 'absolute'
    this.canvas.style.left = '0'
    this.canvas.style.top = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.pointerEvents = 'auto'
    container.appendChild(this.canvas)
  }

  /** 统一为用 / 的路径，避免 Windows 反斜杠导致拼接错误 */
  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  public async initialize(container: HTMLElement, modelPath: string, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT): Promise<void> {
    const { loadLive2DScripts } = await import('./load-live2d-scripts');
    await loadLive2DScripts();

    if (this.container !== container || this.model) {
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

    this.app?.stage.removeChildren();
    this.app?.stage.addChild(this.model);

    this.resizeModel();
    
    window.addEventListener('resize', () => this.resizeModel());
  }

  public resizeModel() {
    if (!this.model || !this.canvas) return;

    const { width, height } = this.model;
    const scaleX = this.canvas.width / width;
    const scaleY = this.canvas.height / height;
    const scale = Math.min(scaleX, scaleY) * 0.82;
    this.model.scale.set(scale);

    // 与 DefaultPet/BongoCat 一致：用模型中心做锚点，中心点放在画布约 (42%, 35%) 处，角色整体偏左上、完整入画
    this.model.anchor.set(0.5, 0.5);
    this.model.x = this.canvas.width * 0.42;
    this.model.y = this.canvas.height * 0.35;
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

  /** 仅当参数存在时设置，避免报错；返回是否设置成功 */
  public trySetParameter(id: string, value: number): boolean {
    const range = this.getParameterRange(id);
    if (range.min === undefined || range.max === undefined) return false;
    try {
      this.setParameterValue(id, value);
      return true;
    } catch {
      return false;
    }
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

    if (this.container && this.canvas && this.container.contains(this.canvas)) {
      try {
        this.container.removeChild(this.canvas);
      } catch (_) {}
      this.container.innerHTML = '';
    }
    this.container = null;
    this.canvas = null;

    try {
      if (this.app) {
        try {
          this.app.destroy(true);
        } catch (_) {}
        this.app = null;
      }
    } catch (_) {}

    try {
      window.removeEventListener('resize', () => this.resizeModel());
    } catch (_) {}
  }
}

export default Live2DManager;
