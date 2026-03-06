#!/usr/bin/env bash
# 在 Linux/macOS 上打包 Windows 安装包（NSIS）
# 用法: ./scripts/build-windows.sh  或  bash scripts/build-windows.sh

set -e
export PATH="${HOME}/.cargo/bin:${PATH}"
# 若通过 rustup 安装过 Rust，加载其环境
[[ -f "${HOME}/.cargo/env" ]] && source "${HOME}/.cargo/env"
unset CI

if ! command -v rustup &>/dev/null; then
  echo "错误: 未找到 rustup。"
  echo "交叉编译 Windows 需要 rustup 来安装 x86_64-pc-windows-msvc 目标。"
  echo ""
  echo "请先安装 rustup（若已用 pacman 安装 rust，可先卸载再装 rustup）："
  echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  echo "安装后重新打开终端，再执行: ./scripts/build-windows.sh"
  exit 1
fi

echo "==> 检查并添加 Windows 编译目标..."
rustup target add x86_64-pc-windows-msvc

# 交叉编译时 cc-rs 会找 clang-cl；若没有则用 clang 做兼容（同源，argv[0] 为 clang-cl 即可）
if ! command -v clang-cl &>/dev/null; then
  if command -v clang &>/dev/null; then
    CLANG_CL_DIR="${HOME}/.cache/workplace-meow-clang-cl"
    mkdir -p "$CLANG_CL_DIR"
    ln -sf "$(command -v clang)" "$CLANG_CL_DIR/clang-cl"
    export PATH="${CLANG_CL_DIR}:${PATH}"
    echo "==> 已用 clang 作为 clang-cl（PATH 已包含 ${CLANG_CL_DIR}）"
  else
    echo "错误: 未找到 clang。交叉编译 Windows 需要 clang（cc-rs 会调用 clang-cl）。"
    echo "请安装: sudo pacman -S clang  （Arch） 或  sudo apt install clang  （Ubuntu）"
    exit 1
  fi
fi

# 确保存在 llvm-rc 兼容的 icon.ico（Reserved 字段为 0）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
if [[ -f "$ROOT_DIR/scripts/gen_ico.py" ]]; then
  echo "==> 生成 Windows 用 icon.ico（llvm-rc 兼容）..."
  python3 "$ROOT_DIR/scripts/gen_ico.py" || true
fi

# Tauri CLI 在 Linux 上打包时会检测 appindicator，缺失会导致 NSIS 打包阶段崩溃
if ! pkg-config --exists appindicator3-0.1 2>/dev/null && ! pkg-config --exists ayatana-appindicator3-0.1 2>/dev/null; then
  echo "提示: 未检测到 libappindicator，NSIS 打包阶段可能报错。"
  echo "      可安装后重试: sudo pacman -S libappindicator  （Arch）"
  echo ""
fi

# 在 Linux 上 Tauri 会写死调用 makensis.exe，而系统只有 makensis。做一个名为 makensis.exe 的脚本并放在 PATH 最前面。
NSIS_WRAPPER="${HOME}/.cache/workplace-meow-nsis-wrapper"
if command -v makensis &>/dev/null; then
  mkdir -p "$NSIS_WRAPPER"
  printf '%s\n' '#!/usr/bin/env sh' 'exec makensis "$@"' > "$NSIS_WRAPPER/makensis.exe"
  chmod +x "$NSIS_WRAPPER/makensis.exe"
  export PATH="${NSIS_WRAPPER}:${PATH}"
  echo "==> 已添加 makensis.exe 包装（调用本机 makensis），PATH 首项: ${NSIS_WRAPPER}"
else
  echo "错误: 未找到 makensis（NSIS）。"
  echo ""
  echo "Arch 上需从 AUR 安装 nsis，yay 若报错可改用浏览器下载快照："
  echo "  1. 浏览器打开: https://aur.archlinux.org/cgit/aur.git/snapshot/nsis.tar.gz"
  echo "  2. 保存到当前目录或 ~/Downloads，然后执行："
  echo "     tar -xvf nsis.tar.gz && cd nsis && makepkg -si"
  echo "  3. 依赖 mingw-w64-zlib 也来自 AUR，可同样用快照安装："
  echo "     https://aur.archlinux.org/cgit/aur.git/snapshot/mingw-w64-zlib.tar.gz"
  echo ""
  exit 1
fi

echo "==> 开始构建 Windows 安装包..."
# 在调用 npm 时再次注入 PATH，确保子进程一定能找到 makensis.exe
env PATH="${NSIS_WRAPPER}:${PATH}" npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc

echo ""
echo "==> 构建完成！"
echo "安装包位置: src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/"
ls -la src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe 2>/dev/null || true
