# dotfiles

个人配置文件管理仓库，使用 GNU Stow 进行管理。

## 📁 目录结构

```
dotfiles/
├── home/           # 用户目录配置 (~/)
│   ├── .config/    # 应用配置
│   │   ├── ghostty/      # Ghostty 终端配置
│   │   ├── niri/         # Niri 窗口管理器配置
│   │   ├── noctalia/     # Noctalia 配置
│   │   ├── nvim/         # Neovim 配置
│   │   ├── yazi/         # Yazi 文件管理器配置
│   │   ├── fontconfig/   # 字体配置
│   │   ├── systemd/      # 用户级 systemd 服务
│   │   ├── xdg-desktop-portal/
│   │   └── starship.toml # Starship 提示符配置
│   ├── .zshrc            # Zsh 配置
│   ├── .zimrc            # Zim 框架配置
│   ├── .background       # 桌面背景
│   └── .face             # 用户头像
├── root/           # 系统级配置 (/)
│   └── etc/
│       ├── hosts         # 主机文件
│       └── ly/           # ly 登录管理器配置
├── podman/         # Podman 容器编排
│   └── compose.yml       # Docker Compose 配置
└── mystow.sh       # Stow 管理脚本
```

## 🚀 快速开始

### 使用 mystow.sh 脚本

`mystow.sh` 是一个增强的 Stow 管理脚本，支持自动备份冲突文件。

**语法：**

```bash
./mystow.sh <PACKAGE> <TARGET_DIR> <apply|revert|update>
```

**操作说明：**

- `apply`: 应用配置（冲突文件会自动备份为 `.stow.bak`）
- `revert`: 撤销配置并还原备份文件
- `update`: 先撤销再应用（用于更新配置）

**示例：**

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
# 应用配置
stow -t ~/ home

# 撤销配置
stow -D -t ~/ home

# 重新应用
stow -R -t ~/ home
```

## 📄 License

个人配置文件，仅供参考。
