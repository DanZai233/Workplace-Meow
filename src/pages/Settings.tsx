import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { AI_PROVIDERS, AIConfig } from '../lib/ai-providers';
import { LIVE2D_MODELS, PERSONAS, Persona } from '../constants';
import { useModel } from '../hooks/useModel';
import { 
  Settings, 
  Save, 
  FolderOpen, 
  Bot, 
  Sparkles,
  Check,
  Loader2
} from 'lucide-react';

export default function SettingsPage() {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-pro',
  });
  const [customModelPath, setCustomModelPath] = useState('');
  const [assistant, setAssistant] = useState<Persona>(PERSONAS[0]);
  const [customAssistant, setCustomAssistant] = useState({
    name: '',
    icon: '🐱',
    description: '',
    prompt: ''
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
 
  const selectedProvider = AI_PROVIDERS.find(p => p.id === config.provider);
  const { models: live2dModels, currentModel, loading: modelLoading, loadModel } = useModel();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await invoke<Record<string, any>>('get_settings');
      
      if (settings.ai_provider) {
        setConfig(prev => ({ ...prev, provider: settings.ai_provider }));
      }
      if (settings.api_key) {
        setConfig(prev => ({ ...prev, apiKey: settings.api_key }));
      }
      if (settings.model_name) {
        setConfig(prev => ({ ...prev, model: settings.model_name }));
      }
      if (settings.model_path) {
        setCustomModelPath(settings.model_path);
      }
      if (settings.assistant_name && settings.assistant_prompt) {
        setCustomAssistant({
          name: settings.assistant_name,
          icon: settings.assistant_icon || '🐱',
          description: settings.assistant_description || '',
          prompt: settings.assistant_prompt
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke('save_settings', {
        settings: {
          ai_provider: config.provider,
          api_key: config.apiKey,
          model_name: config.model,
          model_path: customModelPath,
          assistant_name: customAssistant.name,
          assistant_icon: customAssistant.icon,
          assistant_description: customAssistant.description,
          assistant_prompt: customAssistant.prompt,
        }
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectModelPath = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{
          name: 'Live2D Model',
          extensions: ['moc3', 'model3.json']
        }]
      });
      
      if (selected && typeof selected === 'string') {
        setCustomModelPath(selected);
      }
    } catch (error) {
      console.error('Failed to select model path:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-white" />
              <h1 className="text-2xl font-bold text-white">设置</h1>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600" />
                AI 提供商配置
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    选择 AI 提供商
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {AI_PROVIDERS.map(provider => (
                      <button
                        key={provider.id}
                        onClick={() => setConfig(prev => ({ ...prev, provider: provider.id }))}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          config.provider === provider.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="text-sm font-medium text-slate-800">
                          {provider.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedProvider && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        选择模型
                      </label>
                      <select
                        value={config.model}
                        onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all"
                      >
                        {selectedProvider.models.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        API 密钥
                      </label>
                      <input
                        type="password"
                        value={config.apiKey}
                        onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder="输入你的 API 密钥"
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all"
                      />
                    </div>
                  </>
                )}
              </div>
            </section>

             <section>
               <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                 <Sparkles className="w-5 h-5 text-indigo-600" />
                 Live2D 模型配置
               </h2>
               
               <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-2">
                     选择模型
                   </label>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                     {live2dModels.map(model => (
                       <button
                         key={model.id}
                         onClick={() => {
                           if (canvasRef.current) {
                             loadModel(model, canvasRef.current);
                           }
                         }}
                         disabled={modelLoading}
                         className={`p-4 rounded-xl border-2 transition-all ${
                           currentModel?.id === model.id
                             ? 'border-indigo-600 bg-indigo-50'
                             : 'border-slate-200 hover:border-indigo-300'
                         } ${modelLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                       >
                         <div className="text-sm font-medium text-slate-800">
                           {model.name}
                         </div>
                         {model.isPreset && (
                           <div className="text-xs text-indigo-600 mt-1">
                             内置模型
                           </div>
                         )}
                       </button>
                     ))}
                   </div>
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-2">
                     模型预览
                   </label>
                   <div className="bg-slate-100 rounded-xl p-4 flex items-center justify-center min-h-[200px]">
                     {modelLoading ? (
                       <div className="flex items-center gap-2 text-slate-500">
                         <Loader2 className="w-5 h-5 animate-spin" />
                         <span>加载模型中...</span>
                       </div>
                     ) : (
                       <canvas
                         ref={canvasRef}
                         width={400}
                         height={300}
                         className="rounded-lg"
                       />
                     )}
                   </div>
                 </div>
 
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-2">
                     添加自定义模型
                   </label>
                   <button
                     onClick={handleSelectModelPath}
                     className="flex items-center gap-2 w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                   >
                     <FolderOpen className="w-5 h-5 text-slate-600" />
                     <span>选择 Live2D 模型文件夹</span>
                   </button>
                   {customModelPath && (
                     <div className="mt-2 text-sm text-slate-600">
                       已选择：{customModelPath}
                     </div>
                   )}
                 </div>
               </div>
             </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                自定义助手
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    助手名称
                  </label>
                  <input
                    type="text"
                    value={customAssistant.name}
                    onChange={(e) => setCustomAssistant(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="例如：职场喵"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    图标（Emoji）
                  </label>
                  <input
                    type="text"
                    value={customAssistant.icon}
                    onChange={(e) => setCustomAssistant(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="例如：🐱"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    描述
                  </label>
                  <textarea
                    value={customAssistant.description}
                    onChange={(e) => setCustomAssistant(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="简要描述助手的特点"
                    rows={2}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    系统提示词
                  </label>
                  <textarea
                    value={customAssistant.prompt}
                    onChange={(e) => setCustomAssistant(prev => ({ ...prev, prompt: e.target.value }))}
                    placeholder="定义助手的角色和行为"
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50 transition-all resize-none"
                  />
                </div>
              </div>
            </section>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              {saveSuccess && (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-5 h-5" />
                  <span className="text-sm font-medium">保存成功</span>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors font-medium"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                保存设置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
