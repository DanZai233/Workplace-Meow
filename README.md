<div align="center">
  <h1>🐱 职场桌宠</h1>
  <p>基于 Tauri 的职场助手桌面应用</p>
</div>

## 功能特性

- **桌面宠物展示** - Live2D 模型或自定义 SVG 宠物，在桌面展示
- **智能对话** - 支持多种 AI 提供商（Gemini、OpenAI、火山引擎、DeepSeek 等）
- **助手自定义** - 可配置不同的职场助手人格
- **透明窗口** - 支持点击穿透，不影响其他窗口操作
- **对话气泡** - 实时显示 AI 回复的对话气泡
- **设置管理** - 完整的设置界面，配置 AI、模型、宠物等
- **模型管理** - 参考 BongoCat 的实现，支持 Live2D 模型加载、切换和预览
- **剪贴板监听** - 自动检测复制内容，AI 生成高情商回复
- **番茄钟提醒** - 连续工作2小时提醒喝水休息
- **自动截屏分析** - AI 分析当前工作状态（支持所有AI提供商）
- **情感表情** - AI 分析回复情感，Live2D 展示对应表情
- **鼠标跟随** - Live2D 眼睛实时跟随鼠标移动
- **打字动画** - AI 回复时显示打字动画
- **主动关怀** - 定期发送鼓励和主动发起对话

## AI 提供商支持

- Google Gemini
- OpenAI (GPT-4, GPT-3.5)
- Anthropic Claude
- 火山引擎 (Doubao)
- DeepSeek
- Moonshot AI (Kimi)
- 智谱 AI (GLM)

## 前置要求

- Node.js 18+
- Rust (用于 Tauri)
- 系统依赖：
  - macOS: Xcode Command Line Tools
  - Linux: webkit2gtk（Arch: `sudo pacman -S webkit2gtk-4.1 pkg-config`）
  - Windows: Microsoft C++ Build Tools

## 安装

```bash
npm install
```

## 运行

### 开发模式

```bash
npm run tauri:dev
```

### 构建应用

```bash
npm run tauri:build
```

### 在 Linux 上打包 Windows 安装包（交叉编译）

Tauri 支持在 Linux/macOS 上通过 **NSIS** 打出 Windows 安装包（仅生成 `.exe` 安装程序，无法生成 `.msi`）。若需稳定构建，建议使用 Windows 本机或 GitHub Actions。

**1. 安装依赖**

- **NSIS**（用于生成 Windows 安装程序）
  - Arch: `yay -S nsis` 或 `paru -S nsis`（AUR）
  - Ubuntu: `sudo apt install nsis`
- **LLVM + LLD + Clang**（链接器与 C 编译；交叉编译时 cc-rs 会调用 clang-cl，脚本会用 clang 兼容）
  - Arch: `sudo pacman -S llvm lld clang`
  - Ubuntu: `sudo apt install lld llvm clang`
- **Rust 与 rustup**（交叉编译必须用 rustup 管理的 Rust，不能用 `pacman -S rust`）
  - 若未安装：`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
  - 添加 Windows 目标：`rustup target add x86_64-pc-windows-msvc`
- **cargo-xwin**（自动拉取 Windows SDK，无需本机装 Visual Studio）
  ```bash
  cargo install --locked cargo-xwin
  ```

**2. 执行构建**

推荐（自动加 PATH、添加 target、再构建）：

```bash
chmod +x scripts/build-windows.sh
./scripts/build-windows.sh
```

或手动执行（需保证 `~/.cargo/bin` 在 PATH 中，且已执行过 `rustup target add x86_64-pc-windows-msvc`）。**在 Linux 上打 NSIS 包时**，Tauri 会调用 `makensis.exe`，而系统只有 `makensis`，因此**建议用上面的脚本**（脚本会生成一个名为 `makensis.exe` 的包装并注入 PATH）。若坚持手动执行，需先：

```bash
mkdir -p ~/.cache/workplace-meow-nsis-wrapper
echo '#!/usr/bin/env sh' > ~/.cache/workplace-meow-nsis-wrapper/makensis.exe
echo 'exec makensis "$@"' >> ~/.cache/workplace-meow-nsis-wrapper/makensis.exe
chmod +x ~/.cache/workplace-meow-nsis-wrapper/makensis.exe
export PATH="$HOME/.cache/workplace-meow-nsis-wrapper:$PATH"
npm run tauri:build:win
```

或：

```bash
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc
```

**3. 产物位置**

- 安装包：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/` 下的 `*-setup.exe`

首次构建时 `cargo-xwin` 会下载 Windows SDK，可能较慢。多项目可共享缓存：`export XWIN_CACHE_DIR=~/.cache/xwin`。

若在 Linux 上执行 NSIS 打包时出现 `Can't detect any appindicator library` 并崩溃，可安装：`sudo pacman -S libappindicator`（Arch），然后重新运行打包脚本。若 **.exe 已成功生成**，也可直接使用 `src-tauri/target/x86_64-pc-windows-msvc/release/workplace-meow.exe`（需与 `dist/` 一起拷贝到 Windows 使用，或打 NSIS 安装包后分发）。

## 使用说明

详细使用指南请查看：
- [USAGE.md](USAGE.md) - 基本使用指南
- [LIVE2D_MODELS.md](LIVE2D_MODELS.md) - Live2D 模型管理
- [SYSTEM_FEATURES.md](SYSTEM_FEATURES.md) - 系统级交互功能详解

快速开始：

1. **启动应用** - 运行后会在桌面显示一个透明窗口，包含宠物形象
2. **打开聊天** - 双击宠物或点击右上角聊天按钮
3. **配置设置** - 点击右上角设置按钮，配置 AI 提供商和模型
4. **自定义宠物** - 在设置中选择 Live2D 模型或导入自定义模型
5. **点击穿透** - 默认启用，鼠标会穿透到下层窗口，悬停在按钮上时会自动关闭
6. **剪贴板助手** - 复制文本后桌宠会弹出询问是否需要高情商回复
7. **自动关怀** - 连续工作2小时会收到休息提醒和鼓励
8. **情感互动** - 对话时桌宠会根据回复内容显示不同表情，眼睛跟随鼠标移动

## 项目结构

```
├── src/
│   ├── components/     # React 组件
│   ├── pages/          # 页面组件
│   ├── lib/            # AI 提供商服务
│   │   ├── ai-providers.ts        # AI提供商统一接口
│   │   └── sentiment-analysis.ts  # 情感分析
│   ├── hooks/          # React Hooks
│   │   ├── useModel.ts          # Live2D模型管理
│   │   ├── useMouseTracking.ts   # 鼠标跟随和动画
│   │   ├── useSystemMonitor.ts   # 剪贴板和番茄钟
│   │   └── useActivityMonitoring.ts  # 截屏和关怀
│   ├── utils/          # 工具函数
│   └── constants.ts    # 常量定义
├── src-tauri/          # Tauri Rust 后端
│   ├── src/
│   │   ├── main.rs     # 入口文件
│   │   └── lib.rs      # 核心逻辑和截图功能
│   └── tauri.conf.json # Tauri 配置
└── package.json        # Node.js 依赖
```

## 技术栈

- 前端：React + TypeScript + Tailwind CSS
- 桌面框架：Tauri 2
- Live2D：pixi-live2d-display（参考 [BongoCat](https://github.com/ayangweb/BongoCat) 的实现）
- 动画：Framer Motion
- 图标：Lucide React

## 感谢

本项目参考了 [ayangweb/BongoCat](https://github.com/ayangweb/BongoCat) 的 Live2D 实现，感谢开源社区的支持！

## License

MIT
