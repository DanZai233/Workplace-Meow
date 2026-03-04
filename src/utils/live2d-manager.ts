import type { Cubism4InternalModel } from 'pixi-live2d-display'

import { convertFileSrc } from '@tauri-apps/api/core'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { Cubism4ModelSettings, Live2DModel } from 'pixi-live2d-display'
import { Application, Ticker } from 'pixi.js'

Live2DModel.registerTicker(Ticker)

class Live2DManager {
  private static instance: Live2DManager
  private app: Application | null = null
  public model: Live2DModel | null = null
  private canvas: HTMLCanvasElement | null = null

  private constructor() {}

  static getInstance(): Live2DManager {
    if (!Live2DManager.instance) {
      Live2DManager.instance = new Live2DManager();
    }
    return Live2DManager.instance;
  }

  private initApp() {
    if (this.app) return

    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }

    this.app = new Application({
      view: this.canvas,
      width: this.canvas.width,
      height: this.canvas.height,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
  }

  public async initialize(canvas: HTMLCanvasElement, modelPath: string): Promise<void> {
    this.canvas = canvas;
    this.initApp();
    
    if (this.model) {
      this.destroy();
    }

    const files = await readDir(modelPath);

    const modelFile = files.find(file => file.name.endsWith('.model3.json'));

    if (!modelFile) {
      throw new Error('未找到模型主配置文件 (.model3.json)，请确认模型文件是否完整。');
    }

    const fullPath = modelPath + '/' + modelFile.name;
    const modelJSON = JSON.parse(await readTextFile(fullPath));

    const modelSettings = new Cubism4ModelSettings({
      ...modelJSON,
      url: convertFileSrc(fullPath),
    });

    modelSettings.replaceFiles((file) => {
      return convertFileSrc(modelPath + '/' + file);
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
    const scale = Math.min(scaleX, scaleY) * 0.9;

    this.model.scale.set(scale);
    this.model.x = this.canvas.width / 2;
    this.model.y = this.canvas.height;
    this.model.anchor.set(0.5, 1);
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
    if (this.model) {
      this.model.destroy();
      this.model = null;
    }

    if (this.app) {
      this.app.destroy(true);
      this.app = null;
    }

    this.canvas = null;
    window.removeEventListener('resize', () => this.resizeModel());
  }
}

export default Live2DManager;
