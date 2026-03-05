<div align="center">
  <h1>🐱 职场桌宠</h1>
  <p>基于 Tauri 的职场助手桌面应用</p>
</div>

## 功能特性

- **桌面宠物展示** - Live2D 模型或自定义 SVG 宠物
- **智能对话** - 多会话、多角色，支持 Gemini / OpenAI / 火山引擎 / DeepSeek 等
- **助手预设与个人设定** - 爱莉希雅等预设，可自定义系统提示词
- **透明窗口** - 支持拖动、点击穿透
- **打字与视线** - AI 回复时打字动画，眼睛跟随鼠标
- **设置与模型** - 配置 AI、Live2D 模型路径、自定义助手

## 前置要求

| 环境     | 要求 |
|----------|------|
| Node.js  | 18+  |
| Rust     | 用于 Tauri，建议通过 [rustup](https://rustup.rs/) 安装 |
| 系统依赖 | **macOS**: Xcode Command Line Tools；**Linux**: `webkit2gtk-4.1`（Arch: `sudo pacman -S webkit2gtk-4.1 pkg-config`）；**Windows**: Microsoft C++ Build Tools |

安装依赖后执行：

```bash
npm install
```

---

## 一、启动教程

### 1. 开发模式运行（推荐日常使用）

在项目根目录执行：

```bash
npm run tauri:dev
```

会先编译前端（Vite）和 Tauri，然后启动桌面窗口，并开启前端热更新（改 React/TS 会自动刷新）。

### 2. 运行已编译好的程序

若已经用「编译教程」打过包，可直接运行可执行文件：

- **Windows**：运行 `src-tauri/target/release/workplace-meow.exe`，或安装并运行 NSIS 生成的 `*-setup.exe`
- **macOS**：运行 `src-tauri/target/release/bundle/macos/*.app`
- **Linux**：运行 `src-tauri/target/release/workplace-meow` 或安装生成的 `.deb` / AppImage

### 3. 调试：界面异常或想看报错时

- **自动打开 DevTools**：启动前设置环境变量，再运行程序即可弹出开发者工具。
  - Windows 命令行：`set WORKPLACE_MEOW_DEBUG=1 && 职场桌宠.exe`
  - Windows PowerShell：`$env:WORKPLACE_MEOW_DEBUG="1"; .\职场桌宠.exe`
  - Linux/macOS：`WORKPLACE_MEOW_DEBUG=1 ./workplace-meow`
- **应用内打开控制台**：主窗口右下角「⋯」菜单 →「打开控制台」，即可打开当前窗口的 DevTools。

---

## 二、编译教程

### 1. 本机编译（当前系统运行什么就编什么）

在项目根目录执行：

```bash
npm run tauri:build
```

会先执行 `npm run build` 打包前端，再编译 Rust，最后在 `src-tauri/target/release/` 下生成可执行文件，并在 `src-tauri/target/release/bundle/` 下生成各平台安装包（如 Windows 的 NSIS、macOS 的 .app、Linux 的 .deb 等）。

| 平台   | 可执行文件 / 安装包位置 |
|--------|--------------------------|
| Windows | `src-tauri/target/release/workplace-meow.exe`；安装包在 `.../bundle/nsis/*.exe` |
| macOS   | `src-tauri/target/release/bundle/macos/` 下 .app |
| Linux   | `src-tauri/target/release/workplace-meow`；安装包在 `.../bundle/deb/` 或 AppImage 等 |

### 2. 在 Linux 上交叉编译 Windows 安装包

在 **Linux** 上可打出 Windows 用的 `.exe` 安装包（NSIS），无需 Windows 本机。

**（1）安装依赖**

- **Rust + Windows 目标**（必须用 rustup，不要用系统自带的 `rust`）  
  - 安装 rustup：<https://rustup.rs/>  
  - 添加目标：`rustup target add x86_64-pc-windows-msvc`
- **cargo-xwin**（拉取 Windows SDK，无需装 Visual Studio）  
  ```bash
  cargo install --locked cargo-xwin
  ```
  确保 `~/.cargo/bin` 在 `PATH` 中。
- **NSIS**（打 Windows 安装包）  
  - Arch: `yay -S nsis` 或 `paru -S nsis`  
  - Ubuntu: `sudo apt install nsis`
- **LLVM / Clang**（交叉编译时用）  
  - Arch: `sudo pacman -S llvm lld clang`  
  - Ubuntu: `sudo apt install lld llvm clang`
- **libappindicator**（Arch 上打 NSIS 时若报错再装）  
  - `sudo pacman -S libappindicator`

**（2）执行构建**

推荐使用脚本（会自动处理 PATH、makensis 包装等）：

```bash
chmod +x scripts/build-windows.sh
./scripts/build-windows.sh
```

或手动（需已安装上述依赖，且 `~/.cargo/bin` 在 PATH 中）：

```bash
# 若 Linux 上只有 makensis 没有 makensis.exe，先做包装再构建
mkdir -p ~/.cache/workplace-meow-nsis-wrapper
printf '#!/usr/bin/env sh\nexec makensis "$@"\n' > ~/.cache/workplace-meow-nsis-wrapper/makensis.exe
chmod +x ~/.cache/workplace-meow-nsis-wrapper/makensis.exe
export PATH="$HOME/.cache/workplace-meow-nsis-wrapper:$PATH"

npm run tauri:build:win
```

**（3）产物位置**

- Windows 安装包：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/` 下的 `*-setup.exe`
- 仅 exe（不打包安装程序）：`src-tauri/target/x86_64-pc-windows-msvc/release/workplace-meow.exe`（需与 `dist/` 一起拷贝到 Windows 使用）

首次构建时 cargo-xwin 会下载 Windows SDK，可能较慢；可设置缓存目录：`export XWIN_CACHE_DIR=~/.cache/xwin`。

### 3. GitHub Actions 自动构建（Windows / Linux / macOS）

仓库已配置 GitHub Actions，可在云端自动打出各平台安装包并生成 Release。

**触发方式：**

- **发布版本**：推送版本 tag 即可，例如  
  `git tag v0.1.0 && git push origin v0.1.0`  
  会触发构建，并创建 Draft Release，产物上传到该 Release（可改为正式发布）。
- **仅构建**：在 GitHub 仓库 **Actions** 页选择 “Build and Release”，点击 “Run workflow” 手动运行，同样会生成 Draft Release 与各平台产物。

**构建矩阵：**

| 平台 | 产物说明 |
|------|----------|
| Windows | NSIS 安装包 `*_x64-setup.exe` 等 |
| Linux (Ubuntu 22.04) | `.deb`、AppImage、`.rpm` 等 |
| macOS | Intel 与 Apple Silicon (M1+) 的 `.dmg` / `.app` |

首次运行前请在仓库 **Settings → Actions → General → Workflow permissions** 中勾选 **Read and write permissions**，否则无法创建 Release。

---

## 三、开发教程

### 1. 克隆与安装

```bash
git clone <仓库地址>
cd Workplace-Meow
npm install
```

### 2. 日常开发流程

- **只改前端（React / TypeScript / 样式）**  
  - 运行 `npm run tauri:dev`，保存后会自动热更新。
- **改了 Rust（`src-tauri/src/`）或 Tauri 配置**  
  - 同样用 `npm run tauri:dev`，会重新编译 Rust 再启动。
- **只改前端且不想起 Tauri**  
  - `npm run dev` 仅启动 Vite；此时没有 Tauri API（如 `invoke`、窗口拖动等），仅适合做纯 UI 调试。

### 3. 项目结构速览

```
├── src/                      # 前端 (React + TypeScript)
│   ├── App.tsx               # 主窗口：桌宠、拖动、聊天入口
│   ├── constants.ts          # 预设角色(PERSONAS)、会话类型等
│   ├── components/           # Live2D 桌宠等组件
│   ├── pages/                # 设置页、聊天窗口
│   ├── lib/                  # AI 提供商 (ai-providers.ts)
│   ├── hooks/                # 鼠标跟随、打字动画、模型加载
│   └── utils/                # Live2D 管理、调试日志
├── src-tauri/                # Tauri 后端 (Rust)
│   ├── src/
│   │   ├── main.rs           # 入口
│   │   └── lib.rs            # 命令：设置、窗口、截图、光标等
│   ├── tauri.conf.json       # 窗口/打包配置
│   ├── capabilities/         # 权限配置
│   └── assets/               # 资源（如 Live2D 模型目录）
├── scripts/
│   └── build-windows.sh      # Linux 上打 Windows 包
└── package.json
```

### 4. 常用命令

| 命令 | 说明 |
|------|------|
| `npm run tauri:dev` | 开发模式运行（热更新） |
| `npm run tauri:build` | 本机编译并打安装包 |
| `npm run tauri:build:win` | 在 Linux 上交叉编译 Windows（需先装好依赖与 makensis 包装） |
| `npm run build` | 仅打包前端到 `dist/` |
| `npm run lint` | TypeScript 检查（`tsc --noEmit`） |

### 5. 调试技巧

- 主窗口白屏/无内容：用「启动教程」里的 `WORKPLACE_MEOW_DEBUG=1` 或「⋯ → 打开控制台」看 Console 报错。
- Live2D 不显示：检查 `src-tauri/assets/models/` 下模型路径、`index.html` 中 Live2D 脚本是否先于业务代码加载。
- 改 Rust 后不生效：先 `npm run tauri:build` 或再次 `tauri dev` 确保重新编译。

---

## 使用说明

- **启动**：运行后桌面出现透明窗口和桌宠。
- **聊天**：双击桌宠或点击右上角聊天图标，打开独立聊天窗口；可新建多会话、每会话选不同角色（预设/个人设定）。
- **设置**：右上角设置 → 配置 AI 提供商与 API Key、Live2D 模型路径、自定义助手名称与系统提示词。
- **拖动**：在非按钮区域按住并移动鼠标可拖动主窗口；右下角「⋯」可锁定/解锁拖动。
- **关闭**：「⋯」→「关闭程序」。

更多说明可参考项目内文档（若有）：USAGE.md、LIVE2D_MODELS.md 等。

## 技术栈

- 前端：React 19 + TypeScript + Vite + Tailwind CSS + Framer Motion
- 桌面：Tauri 2
- Live2D：pixi-live2d-display + Pixi.js

## 致谢

Live2D 集成参考了 [BongoCat](https://github.com/ayangweb/BongoCat)，感谢开源社区。

## License

MIT
