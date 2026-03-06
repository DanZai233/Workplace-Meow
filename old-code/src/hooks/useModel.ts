import { useEffect, useState, useRef } from 'react';
import { resolveResource } from '@tauri-apps/api/path';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import Live2DManager from '../utils/live2d-manager';

export interface Live2DModel {
  id: string;
  name: string;
  path: string;
  isPreset: boolean;
}

export interface ModelSize {
  width: number;
  height: number;
}

export function useModel() {
  const [models, setModels] = useState<Live2DModel[]>([]);
  const [currentModel, setCurrentModel] = useState<Live2DModel | null>(null);
  const [loading, setLoading] = useState(false);
  
  const managerRef = useRef<Live2DManager | null>(null);
  const appWindow = getCurrentWebviewWindow();

  useEffect(() => {
    initModels();
  }, []);

  const initModels = async () => {
    try {
      setLoading(true);
      
      const modelsPath = await resolveResource('assets/models');
      
      const presetModels: Live2DModel[] = [
        {
          id: 'elysia',
          name: '爱莉希雅',
          path: `${modelsPath}/elsia`,
          isPreset: true
        },
        {
          id: 'standard',
          name: '标准模型',
          path: `${modelsPath}/standard`,
          isPreset: true
        },
        {
          id: 'custom',
          name: '自定义模型',
          path: '',
          isPreset: false
        },
      ];

      setModels(presetModels);

      const savedCurrentModelId = localStorage.getItem('currentModelId');
      // 旧版默认是 standard，统一改为爱莉希雅；无保存时也用爱莉希雅
      const preferElysia = !savedCurrentModelId || savedCurrentModelId === 'standard';
      const savedModel = preferElysia ? undefined : presetModels.find(m => m.id === savedCurrentModelId);
      const modelToUse = savedModel || presetModels[0];
      setCurrentModel(modelToUse);
      if (preferElysia) localStorage.setItem('currentModelId', modelToUse.id);
    } catch (error) {
      console.error('Failed to init models:', error);
    } finally {
      setLoading(false);
    }
  };

  /** 解析模型路径：仅名称（如 elsia）转为 resource 下路径，否则原样返回（并统一分隔符） */
  const resolveModelPath = async (rawPath: string): Promise<string> => {
    const trimmed = rawPath?.trim();
    if (!trimmed) return trimmed;
    if (trimmed.includes('/') || trimmed.includes('\\')) {
      return trimmed.replace(/\\/g, '/');
    }
    const base = await resolveResource('assets/models');
    return `${base}/${trimmed}`;
  };

  const loadModel = async (model: Live2DModel, container: HTMLElement) => {
    if (!model.path) return;
    try {
      setLoading(true);
      const manager = Live2DManager.getInstance();
      managerRef.current = manager;
      const path = await resolveModelPath(model.path);
      await manager.initialize(container, path, 400, 300);
      setCurrentModel(model);
      localStorage.setItem('currentModelId', model.id);
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      await appWindow.setSize(new LogicalSize({ width: 400, height: 300 }));
    } catch (error) {
      console.error('Failed to load model:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /** 用任意路径/名称加载模型（用于设置页预览与主窗口）；传入容器，由 Pixi 自行创建 canvas 避免 WebGL 报错 */
  const loadModelByPath = async (rawPath: string, container: HTMLElement) => {
    if (!rawPath?.trim()) return;
    try {
      setLoading(true);
      const manager = Live2DManager.getInstance();
      managerRef.current = manager;
      const path = await resolveModelPath(rawPath);
      await manager.initialize(container, path, 400, 300);
      const customModel = { id: 'custom', name: '自定义', path: rawPath.trim(), isPreset: false };
      setCurrentModel(customModel);
    } catch (error) {
      console.error('Failed to load model by path:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const playMotion = async (group: string, index: number) => {
    const manager = managerRef.current;
    if (!manager) return;
    
    try {
      await manager.playMotion(group, index);
    } catch (error) {
      console.error('Failed to play motion:', error);
    }
  };

  const setParameterValue = (id: string, value: number | boolean) => {
    const manager = managerRef.current;
    if (!manager) return;
    
    try {
      manager.setParameterValue(id, value);
    } catch (error) {
      console.error('Failed to set parameter:', error);
    }
  };

  return {
    models,
    currentModel,
    loading,
    loadModel,
    loadModelByPath,
    resolveModelPath,
    playMotion,
    setParameterValue,
    setCurrentModel,
  };
}
