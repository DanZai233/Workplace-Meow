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
      const savedModel = presetModels.find(m => m.id === savedCurrentModelId);
      
      setCurrentModel(savedModel || presetModels[0]);
    } catch (error) {
      console.error('Failed to init models:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModel = async (model: Live2DModel, canvas: HTMLCanvasElement) => {
    try {
      setLoading(true);
      
      const manager = Live2DManager.getInstance();
      managerRef.current = manager;
      
      await manager.initialize(canvas, model.path);
      
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
    playMotion,
    setParameterValue,
    setCurrentModel,
  };
}
