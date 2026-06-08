# dotfiles

个人 dotfiles 仓库，使用 [chezmoi](https://www.chezmoi.io/) 管理。当前配置主要面向一套 Wayland / Niri 桌面环境，并覆盖 Shell、终端、编辑器、文件管理器、输入法主题、AI agent 配置与系统级配置同步脚本。

> 这是个人配置仓库，不是通用发行版。配置中存在少量硬编码路径（例如 `/home/x`、`/run/media/x/...`），迁移到其他用户名或机器前需要先检查并调整。

## 主要内容

| 路径 | 目标位置 | 说明 |
| --- | --- | --- |
| `dot_zshrc` | `~/.zshrc` | Zsh 启动配置：Zim、Starship、zoxide、uv 补全、eza/yazi 等别名与函数。 |
| `dot_zimrc` | `~/.zimrc` | Zim Framework 模块列表。 |
| `dot_gitconfig` | `~/.gitconfig` | Git 全局配置，目前默认 `pull --rebase`。 |
| `dot_config/starship.toml` | `~/.config/starship.toml` | Catppuccin Mocha 风格的 Starship prompt。 |
| `dot_config/nvim/` | `~/.config/nvim/` | 基于 LazyVim 的 Neovim 配置，包含 Catppuccin、Markdown、LeetCode、图片与输入法集成等插件配置。 |
| `dot_config/niri/` | `~/.config/niri/` | Niri 配置，按 input / output / layout / startup / keybinds 等模块拆分。 |
| `dot_config/ghostty/` | `~/.config/ghostty/` | Ghostty 终端配置与 Catppuccin Mocha 主题。 |
| `dot_config/yazi/` | `~/.config/yazi/` | Yazi 文件管理器配置、快捷键、插件与 Catppuccin 主题。 |
| `dot_config/noctalia/` | `~/.config/noctalia/` | Noctalia shell 设置、颜色和插件状态。 |
| `dot_local/share/fcitx5/themes/` | `~/.local/share/fcitx5/themes/` | Fcitx5 Catppuccin Latte / Mocha 输入法主题。 |
| `dot_local/share/private_flatpak/overrides/` | `~/.local/share/flatpak/overrides/` | Flatpak overrides。 |
| `dot_pi/` | `~/.pi/` | pi agent 的主题、技能、best practices、settings 等配置。 |
| `dot_ssh/encrypted_*.asc` | `~/.ssh/*` | 通过 chezmoi + GPG 对称加密管理的 SSH 配置与密钥。 |
| `dot_config/root/` | `~/.config/root/` | 系统级配置源目录（如 ly、mihomo），应用后可由 run_once 脚本软链到系统根目录。 |
| `run_once_after_sync-root-filesystem.sh` | chezmoi script | 首次应用后同步 `~/.config/root/**` 到 `/` 下同路径软链接；需要 `sudo`，会覆盖同名目标路径。 |

## chezmoi 命名约定

本仓库使用 chezmoi 的源目录命名规则：

- `dot_foo` -> `~/.foo`
- `private_foo` -> 私有权限文件/目录
- `executable_foo` -> 带可执行权限
- `readonly_foo` -> 只读文件
- `encrypted_foo.asc` -> 源仓库中为加密文件，应用到目标机器时解密为 `foo`
- `*.tmpl` -> Go template，会在 `chezmoi apply` 时渲染
- `run_once_after_*.sh` -> chezmoi 脚本，在文件应用后执行一次；本仓库用于建立系统级配置软链接

当前 `.chezmoi.toml.tmpl` 使用 GPG 对称加密：首次初始化或应用时会提示输入 `passphrase`，用于解密仓库中的 `encrypted_*.asc` 文件。

## 依赖

### 核心依赖

至少需要：

- `git`
- `chezmoi`
- `gpg`
- `zsh`
- `sudo`（仅 `run_once_after_sync-root-filesystem.sh` 同步系统级配置时需要）

### 常用命令行工具

Shell 和日常工作流会用到：

- `starship`
- `zimfw`（由 `.zshrc` 在缺失时自动下载）
- `eza`
- `zoxide`
- `fzf`
- `uv` / `uvx`
- `trash-cli`（提供 `trash-put`，用于 `rmx` alias）
- `yazi`
- `nvim`

### 桌面环境相关

Wayland / Niri 桌面配置会用到：

- `niri`
- `ghostty`
- `fcitx5`
- `noctalia`
- `xdg-desktop-portal-gtk`
- `xdg-desktop-portal-gnome`
- `xdg-desktop-portal-hyprland`
- `wireplumber` / `wpctl`
- `playerctl`
- `brightnessctl`
- `grim`
- `slurp`
- `satty`
- `wl-clipboard`
- `cliphist`

具体包名按发行版调整。

## 首次部署

> 在新机器上应用前，先确认你知道 GPG 对称加密的 passphrase，否则 encrypted 文件无法解密。
>
> 本仓库包含 `run_once_after_sync-root-filesystem.sh`。首次 `chezmoi apply` 后它会尝试用 `sudo ln -sf` 把 `~/.config/root/**` 软链接到 `/` 下同路径；执行前务必先审查 `dot_config/root/` 和脚本内容。

```bash
# 1. 安装 git / chezmoi / gpg 等依赖

# 2. 初始化仓库
chezmoi init <repo-url>

# 3. 先查看将要修改的内容
chezmoi diff

# 4. 确认无误后应用
chezmoi apply
```

如果已经把仓库放在默认源目录：

```bash
cd ~/.local/share/chezmoi
chezmoi diff
chezmoi apply
```

也可以一次性初始化并应用：

```bash
chezmoi init --apply <repo-url>
```

## 日常维护

### 查看差异

```bash
chezmoi status
chezmoi diff
```

### 编辑源文件

```bash
chezmoi edit ~/.zshrc
chezmoi edit ~/.config/niri/config.kdl
chezmoi apply
```

### 把目标文件同步回仓库

```bash
chezmoi add ~/.zshrc
chezmoi add ~/.config/nvim --recursive
```

### 添加加密文件

```bash
chezmoi add ~/.ssh/config --encrypt
chezmoi add ~/.ssh/id_ed25519 --encrypt
```

提交前建议先确认没有明文敏感信息：

```bash
chezmoi diff
git status --short
```

### 系统级配置同步

`run_once_after_sync-root-filesystem.sh` 会在 chezmoi 应用完成后执行一次：

1. 检查 `$HOME/.config/root` 是否存在。
2. 遍历其中所有文件。
3. 为每个文件创建对应的系统目录。
4. 用 `sudo ln -sf` 将其软链接到 `/` 下同路径。

例如：

```text
~/.config/root/etc/ly/config.ini -> /etc/ly/config.ini
~/.config/root/etc/mihomo/config.yaml -> /etc/mihomo/config.yaml
```

已建立软链接后，更新 `dot_config/root/` 中已有文件通常会直接反映到系统路径；新增系统级文件时，需要重新执行同步脚本或手动建立对应软链接。

## Shell 约定

`dot_zshrc` 的重点：

- 启动时缓存 `starship init zsh`、`zoxide init zsh`、`uv` / `uvx` 补全，减少每次开 shell 的 fork/exec 成本。
- 使用 Zim Framework 管理 Zsh 模块。
- 历史文件为 `~/.zhistory`，在仓库中以 `encrypted_private_dot_zhistory.asc` 加密保存。
- 常用 alias：
  - `ls` / `ll` / `la` / `tree` -> `eza`
  - `rmx` -> `trash-put`
  - `leetcode` -> `nvim leetcode.nvim`
- `y()` 函数用于从 Yazi 退出后同步当前 shell 工作目录。

## Niri 快捷键摘记

完整配置见 `dot_config/niri/configs/keybinds.kdl`。

| 快捷键 | 动作 |
| --- | --- |
| `Mod+Shift+/` | 显示热键提示。 |
| `Mod+T` | 打开 Ghostty。 |
| `Mod+E` | 在 Ghostty 中打开 Yazi。 |
| `Mod+B` | 启动 Zen Browser。 |
| `Mod+O` | 打开 / 关闭 overview。 |
| `Mod+Q` | 关闭窗口。 |
| `Mod+H/J/K/L` | 在列 / 窗口 / 工作区间移动焦点。 |
| `Mod+Shift+H/J/K/L` | 移动或合并 / 移出窗口。 |
| `Mod+1..9` | 切换工作区。 |
| `Mod+Shift+1..9` | 移动列到指定工作区。 |
| `Mod+R` | 切换预设列宽。 |
| `Mod+F` | 最大化列。 |
| `Mod+Shift+F` | 窗口全屏。 |
| `Mod+V` | 切换浮动窗口。 |
| `Mod+W` | 切换列的 tabbed display。 |
| `Print` / `Mod+P` | 截图。 |
| `Mod+S` | 区域截图并复制到剪贴板，同时保存到 `~/Pictures/Screenshots/`。 |
| `Mod+Shift+E` | 退出 Niri（带确认）。 |

## Yazi 快捷键摘记

完整配置见 `dot_config/yazi/keymap.toml`。

| 快捷键 | 动作 |
| --- | --- |
| `A` | 使用 `compress` 插件打包选中文件。 |
| `C c` | 复制文件路径。 |
| `C d` | 复制目录路径。 |
| `C f` | 复制文件名。 |
| `C n` | 复制不含扩展名的文件名。 |
| `C t` | 复制文件内容。 |
| `c m` | 对选中文件执行 chmod。 |
| `d d` | 移动到回收站。 |
| `d D` | 永久删除。 |
| `d u` / `d U` | 恢复删除，后者为交互模式。 |
| `g s` | 打开 SSHFS 菜单。 |
| `g w` | 跳转到 Windows 挂载目录。 |

## 加密与敏感文件

仓库中以下内容以加密形式保存：

- SSH 配置与密钥：`dot_ssh/encrypted_*.asc`
- Shell 历史：`encrypted_private_dot_zhistory.asc`
- mihomo 配置：`dot_config/root/etc/mihomo/encrypted_config.yaml.asc`
- rpiv-web-tools 配置：`dot_config/rpiv-web-tools/encrypted_private_config.json.asc`
- pi agent auth：`dot_pi/agent/encrypted_private_auth.json.asc`

注意事项：

1. 不要把解密后的明文文件提交进仓库。
2. 新增敏感文件时使用 `chezmoi add --encrypt <path>`。
3. 对外分享仓库前，确认历史提交中没有出现过明文密钥、token 或个人隐私。

## 系统级配置

`dot_config/root/` 下的内容会先由 chezmoi 应用到 `~/.config/root/...`，随后由 `run_once_after_sync-root-filesystem.sh` 软链接到系统根目录：

- `etc/ly/`：ly 显示管理器配置与 logo，目标路径为 `/etc/ly/...`。
- `etc/mihomo/`：mihomo 配置（加密），目标路径为 `/etc/mihomo/...`。

同步脚本的行为是“以 `~/.config/root` 为源目录，覆盖创建到 `/` 的同路径软链接”。这能让系统配置继续由 chezmoi 源目录管理，但也意味着首次部署可能替换已有 `/etc/...` 文件。迁移到新机器前建议先备份对应系统文件，并优先执行 `chezmoi diff` 审查变更。

## 已知个人化点

迁移或给其他机器使用前，建议检查：

- `dot_zshrc` 中的 `PATH`：包含 `/home/x/.opencode/bin`、`~/go/bin`、`~/.npm-global/bin` 等。
- `dot_config/systemd/user/nanobot-gateway.service`：依赖 `/home/x/nanobot`。
- `dot_config/niri/configs/outputs.kdl`：包含 `eDP-1`、`DP-1` 及固定分辨率/缩放。
- `dot_config/yazi/keymap.toml`：`g w` 指向 `/run/media/x/Win/Users/x`。
- `dot_config/ghostty/config`：字体为 `Maple Mono NF CN`。
- `run_once_after_sync-root-filesystem.sh`：会通过 `sudo ln -sf` 覆盖创建系统路径软链接。

如果要提高可移植性，优先把这些路径改成 chezmoi template，根据 hostname / username 分支渲染。
