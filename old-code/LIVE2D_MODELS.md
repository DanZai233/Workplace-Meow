# Live2D 模型管理

本项目参考 [BongoCat](https://github.com/ayangweb/BongoCat) 的 Live2D 实现和模型管理系统。

## 模型来源

### 从 BongoCat 获取模型

BongoCat 项目提供了多个优质 Live2D 模型，您可以从以下仓库获取：

1. **[BongoCat 原版模型](https://github.com/ayangweb/BongoCat)**
   - Haru - 活泼可爱的女孩
   - Hiyori - 温柔可爱的女孩
   - Koharu - 元气满满的女孩
   - Izumi - 优雅知性的女孩

2. **[Awesome-BongoCat](https://github.com/ayangweb/Awesome-BongoCat)**
   - 社区贡献的更多模型
   - 各种风格的角色
   - 持续更新

### 内置模型

项目已预置以下模型（在 `assets/models/` 目录下）：
- Haru
- Hiyori
- Koharu
- Izumi

## 模型格式要求

- 支持 **Live2D Cubism 4** 模型格式
- 模型文件夹必须包含 `.model3.json` 配置文件
- 相关资源文件（纹理、物理等）需要在同一目录下

## 模型导入

### 方法 1：从设置页面导入

1. 打开设置页面
2. 在"Live2D 模型配置"部分，点击"选择 Live2D 模型文件夹"
3. 选择包含 `.model3.json` 文件的文件夹
4. 模型会自动加载并预览

### 方法 2：手动放置

将模型文件夹复制到以下位置：
- **开发环境**: `src-tauri/assets/models/`
- **生产环境**: 应用数据目录的 `models/` 子目录

## 模型切换

1. 在设置页面的模型列表中选择想要的模型
2. 点击后会自动加载并预览
3. 选择确认后，当前模型会被保存

## 技术实现

### 核心组件

- **Live2DManager**: 单例模式管理 Live2D 模型
  - 模型加载与销毁
  - 动画控制
  - 参数设置
  
- **useModel Hook**: React Hook 管理模型状态
  - 模型列表管理
  - 当前模型切换
  - 加载状态管理

### 参考的 BongoCat 实现

本项目参考了以下 BongoCat 的优秀实现：

1. **Live2D 核心集成**
   - 使用 `pixi-live2d-display` + `Cubism4ModelSettings`
   - 通过 Tauri 的 `resolveResource` 访问本地资源
   - 支持从文件系统读取模型

2. **模型管理系统**
   - 区分内置模型和自定义模型
   - 使用 Pinia 管理状态（BongoCat）
   - 使用 React Hook 管理状态（本项目）

3. **窗口自适应**
   - 根据模型尺寸自动调整窗口大小
   - 模型居中显示和自动缩放

4. **动作和表情控制**
   - 支持播放模型动作
   - 支持切换模型表情
   - 实时参数控制

## 模型转换工具

如果您有其他格式的 Live2D 模型，可以使用以下工具转换：

- **[BongoCat 在线转换](https://bongocat.vteamer.cc)**

## 常见问题

### Q: 模型加载失败怎么办？

A: 请检查：
1. 模型文件夹是否包含 `.model3.json` 文件
2. 相关资源文件是否完整
3. 模型是否为 Live2D Cubism 4 格式

### Q: 如何更换模型？

A: 在设置页面的"Live2D 模型配置"部分，选择或导入新模型即可。

### Q: 模型显示不全或变形？

A: 项目会自动调整窗口大小以适应模型。如果仍有问题，请检查模型配置文件。

## 感谢

特别感谢 [ayangweb/BongoCat](https://github.com/ayangweb/BongoCat) 项目的优秀实现，为开源社区提供了宝贵的参考！
