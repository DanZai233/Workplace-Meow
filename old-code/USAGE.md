# 职场桌宠 - 使用指南

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行应用

```bash
npm run tauri:dev
```

### 3. 构建应用

```bash
npm run tauri:build
```

## 功能使用

### 基本操作

1. **启动应用**
   - 运行后会在桌面显示一个透明窗口
   - 窗口中有一个可爱的宠物形象（默认为 SVG 绘制的猫咪）

2. **打开聊天窗口**
   - 双击宠物形象
   - 或点击右上角的聊天按钮

3. **设置配置**
   - 点击右上角的设置按钮
   - 配置 AI 提供商、模型、Live2D 宠物等

### AI 配置

#### 支持的 AI 提供商

- **Google Gemini**
  - 模型：gemini-2.5-pro, gemini-2.0-flash, gemini-1.5-pro 等
  - API Key: 从 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取

- **OpenAI**
  - 模型：gpt-4.1, gpt-4-turbo, gpt-3.5-turbo 等
  - API Key: 从 [OpenAI Platform](https://platform.openai.com/api-keys) 获取

- **Anthropic Claude**
  - 模型：claude-3-7-sonnet, claude-3-5-sonnet 等
  - API Key: 从 [Anthropic Console](https://console.anthropic.com/settings/keys) 获取

- **火山引擎 (Doubao)**
  - 模型：doubao-pro-32k, doubao-pro-128k 等
  - API Key: 从 [火山引擎控制台](https://console.volcengine.com/ark) 获取

- **DeepSeek**
  - 模型：deepseek-chat, deepseek-coder
  - API Key: 从 [DeepSeek 开放平台](https://platform.deepseek.com/) 获取

- **Moonshot AI (Kimi)**
  - 模型：moonshot-v1-8k, moonshot-v1-32k 等
  - API Key: 从 [Moonshot 控制台](https://platform.moonshot.cn/console/api-keys) 获取

- **智谱 AI (GLM)**
  - 模型：glm-4-plus, glm-4-air 等
  - API Key: 从 [智谱AI开放平台](https://open.bigmodel.cn/usercenter/apikeys) 获取

#### 配置步骤

1. 打开设置页面
2. 选择 AI 提供商
3. 选择模型
4. 输入 API 密钥
5. 保存设置

### Live2D 宠物配置

#### 内置模型

- **Haru** - 活泼可爱的女孩
- **Hiyori** - 温柔可爱的女孩
- **Koharu** - 元气满满的女孩
- **Izumi** - 优雅知性的女孩

#### 自定义模型

1. 在设置中选择"自定义模型"
2. 点击文件夹图标选择模型文件
3. 支持格式：.moc3, .model3.json
4. 模型会自动加载并显示

### 助手配置

#### 预设助手

- **老练导师** 🦉 - 经验丰富，提供战略性建议
- **高情商HR** 🤝 - 精通人情世故，擅长沟通
- **直率主管** ⚡ - 结果导向，追求效率
- **职场搭子** ☕ - 贴心朋友，帮你吐槽
- **技术专家** 💻 - 精通编程，解决技术问题
- **文案大师** ✍️ - 文笔出色，擅长撰写文档
- **数据分析师** 📊 - 擅长数据分析
- **产品经理** 🚀 - 理解用户需求

#### 自定义助手

在设置页面中：

1. 输入助手名称
2. 选择图标（Emoji）
3. 填写描述
4. 编写系统提示词（定义助手的角色和行为）
5. 保存设置

### 窗口操作

- **点击穿透** - 默认启用，鼠标会穿透到下层窗口
- **自动关闭** - 鼠标悬停在按钮上时，点击穿透会自动关闭
- **拖动窗口** - 按住宠物可以拖动窗口位置

### 快捷指令

在聊天窗口侧边栏，可以使用以下快捷指令：

- **润色邮件** - 帮助撰写专业的邮件
- **高情商回复** - 提供得体的回复建议
- **周报生成** - 整理工作内容为周报
- **我要吐槽** - 吐槽工作中的问题
- **模拟面试** - 进行面试练习

## 常见问题

### Q: 如何更换宠物模型？

A: 打开设置页面，在 Live2D 模型配置中选择模型，或点击文件夹图标选择自定义模型。

### Q: API 密钥存储在哪里？

A: API 密钥存储在本地应用数据中，不会上传到任何服务器。

### Q: 如何让宠物不干扰工作？

A: 开启点击穿透功能，鼠标会穿透到下层窗口。只在需要交互时（如点击按钮）才会响应。

### Q: 支持哪些 Live2D 模型？

A: 支持 Live2D Cubism SDK for WebGL 标准模型（.moc3 格式）。

### Q: 如何添加自定义助手？

A: 在设置页面的"自定义助手"部分，填写名称、图标、描述和系统提示词即可。

### Q: 应用支持哪些平台？

A: 支持 macOS、Windows 和 Linux。

### Q: 如何获取 AI API 密钥？

A: 参考上文各 AI 提供商的链接，注册账号后在控制台获取 API 密钥。

## 技术支持

如有问题，请提交 Issue 或查看项目文档。

## License

MIT
