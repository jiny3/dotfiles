# dotfiles

个人配置文件管理仓库，使用 GNU Stow 进行管理。统一采用 **Catppuccin Mocha** 主题。

## 工具栈

| 类别 | 工具 |
|------|------|
| 窗口管理器 | [Niri](https://github.com/YaLTeR/niri) (Wayland) |
| 桌面面板 | [Noctalia](https://github.com/nicobrinkkemper/noctalia) |
| 终端模拟器 | [Ghostty](https://ghostty.org) |
| Shell | Zsh + [Zim](https://zimfw.sh) + [Starship](https://starship.rs) |
| 编辑器 | [Neovim](https://neovim.io) (LazyVim) |
| 文件管理器 | [Yazi](https://yazi-rs.github.io) |
| 输入法 | [Fcitx5](https://fcitx-im.org) |
| 字体 | Maple Mono NF CN / Noto Sans CJK SC |
| 登录管理器 | [Ly](https://github.com/fairyglade/ly) |
| 容器 | Podman (Caddy + Vaultwarden + Alist) |
| 代理 | [Mihomo](https://github.com/MetaCubeX/mihomo) (Clash) |

## 目录结构

```
dotfiles/
├── home/               # 用户目录配置 (stow target: ~/)
│   ├── .config/
│   │   ├── ghostty/          # Ghostty 终端配置 + Catppuccin 主题
│   │   ├── niri/             # Niri 窗口管理器配置
│   │   ├── noctalia/         # Noctalia 面板/Dock/启动器配置
│   │   ├── nvim/             # Neovim (LazyVim + Copilot)
│   │   ├── yazi/             # Yazi 文件管理器 + 插件
│   │   ├── fontconfig/       # 字体渲染与回退配置
│   │   ├── opencode/         # OpenCode AI 工具配置
│   │   ├── starship.toml     # Starship 提示符配置
│   │   ├── systemd/user/     # 用户级 systemd 服务
│   │   └── xdg-desktop-portal/
│   ├── .local/
│   │   └── share/
│   │       ├── fcitx5/themes/    # Fcitx5 Catppuccin 主题
│   │       ├── flatpak/overrides/ # Flatpak 权限覆盖
│   │       └── niri/             # DPI 自适应脚本
│   ├── .ssh/             # SSH 密钥与主机配置
│   ├── .zshrc            # Zsh 配置
│   ├── .zimrc            # Zim 框架模块
│   ├── .background       # 亮色壁纸
│   ├── .background-dark  # 暗色壁纸
│   └── .face             # 用户头像
├── caddy/              # Caddy 反向代理配置
│   └── config/
│       └── Caddyfile         # vault.arch / files.arch / arch
├── podman/             # Podman 容器编排
│   └── compose.yml           # Caddy + Vaultwarden + Alist
├── root/               # 系统级配置 (stow target: /)
│   └── etc/
│       ├── hosts             # 本地服务域名映射
│       ├── ly/               # Ly 登录管理器配置 + 动画
│       └── mihomo/           # Mihomo 代理规则配置
├── mystow.sh           # Stow 管理脚本
└── README.md
```

## 快速开始

### 使用 mystow.sh 脚本

`mystow.sh` 是一个增强的 Stow 管理脚本，支持自动备份冲突文件。

```bash
./mystow.sh <PACKAGE> <TARGET_DIR> <apply|revert|update>
```

- `apply`: 应用配置（冲突文件会自动备份为 `.stow.bak`）
- `revert`: 撤销配置并还原备份文件
- `update`: 先撤销再应用（用于更新配置）

```bash
# 应用 home 配置到用户目录
./mystow.sh home ~/ apply

# 应用系统配置（需要 root 权限）
sudo ./mystow.sh root / apply

# 更新配置
./mystow.sh home ~/ update

# 撤销配置
./mystow.sh home ~/ revert
```

### 使用原生 Stow

```bash
stow -t ~/ home          # 应用配置
stow -D -t ~/ home       # 撤销配置
stow -R -t ~/ home       # 重新应用
```

## License

个人配置文件，仅供参考。
