# init cache — avoid fork+exec on every shell open
_zshrc_cache="$HOME/.cache/zsh"
[[ -d $_zshrc_cache ]] || mkdir -p "$_zshrc_cache"
_cache_eval() {
  local name=$1; shift; local cache="$_zshrc_cache/$name" bin="$(command -v $1)"
  [[ -f $cache && $cache -nt $bin ]] || "$@" >! "$cache"
  source "$cache"
}

# starship load
_cache_eval starship starship init zsh

# Start configuration added by Zim Framework install {{{
#
# User configuration sourced by interactive shells
#

# -----------------
# Zsh configuration
# -----------------

#
# History
#

#
# Input/output
#

# Prompt for spelling correction of commands.
#setopt CORRECT

# Customize spelling correction prompt.
#SPROMPT='zsh: correct %F{red}%R%f to %F{green}%r%f [nyae]? '

# Remove path separator from WORDCHARS.
WORDCHARS=${WORDCHARS//[\/]}

# --------------------
# Module configuration
# --------------------

#
# git
#

# Set a custom prefix for the generated aliases. The default prefix is 'G'.
#zstyle ':zim:git' aliases-prefix 'g'

#
# input
#

# Append `../` to your input for each `.` you type after an initial `..`
#zstyle ':zim:input' double-dot-expand yes

#
# termtitle
#

# Set a custom terminal title format using prompt expansion escape sequences.
# See http://zsh.sourceforge.net/Doc/Release/Prompt-Expansion.html#Simple-Prompt-Escapes
# If none is provided, the default '%n@%m: %~' is used.
#zstyle ':zim:termtitle' format '%1~'

#
# zsh-autosuggestions
#

# Disable automatic widget re-binding on each precmd. This can be set when
# zsh-users/zsh-autosuggestions is the last module in your ~/.zimrc.
ZSH_AUTOSUGGEST_MANUAL_REBIND=1

# Customize the style that the suggestions are shown with.
# See https://github.com/zsh-users/zsh-autosuggestions/blob/master/README.md#suggestion-highlight-style
#ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=242'

#
# zsh-syntax-highlighting
#

# Set what highlighters will be used.
# See https://github.com/zsh-users/zsh-syntax-highlighting/blob/master/docs/highlighters.md
ZSH_HIGHLIGHT_HIGHLIGHTERS=(main brackets)

# Customize the main highlighter styles.
# See https://github.com/zsh-users/zsh-syntax-highlighting/blob/master/docs/highlighters/main.md#how-to-tweak-it
#typeset -A ZSH_HIGHLIGHT_STYLES
#ZSH_HIGHLIGHT_STYLES[comment]='fg=242'

# ------------------
# Initialize modules
# ------------------

ZIM_HOME=${ZDOTDIR:-${HOME}}/.zim
# Download zimfw plugin manager if missing.
if [[ ! -e ${ZIM_HOME}/zimfw.zsh ]]; then
  if (( ${+commands[curl]} )); then
    curl -fsSL --create-dirs -o ${ZIM_HOME}/zimfw.zsh \
        https://github.com/zimfw/zimfw/releases/latest/download/zimfw.zsh
  else
    mkdir -p ${ZIM_HOME} && wget -nv -O ${ZIM_HOME}/zimfw.zsh \
        https://github.com/zimfw/zimfw/releases/latest/download/zimfw.zsh
  fi
fi
# Install missing modules, and update ${ZIM_HOME}/init.zsh if missing or outdated.
if [[ ! ${ZIM_HOME}/init.zsh -nt ${ZIM_CONFIG_FILE:-${ZDOTDIR:-${HOME}}/.zimrc} ]]; then
  source ${ZIM_HOME}/zimfw.zsh init
fi
# Initialize modules.
source ${ZIM_HOME}/init.zsh
# }}} End configuration added by Zim Framework install

# Created by newuser for 5.9

# History settings
HISTFILE="$HOME/.zhistory"
HISTSIZE=10000
SAVEHIST=10000

setopt EXTENDED_HISTORY HIST_IGNORE_ALL_DUPS HIST_SAVE_NO_DUPS \
       HIST_EXPIRE_DUPS_FIRST INC_APPEND_HISTORY SHARE_HISTORY \
       HIST_REDUCE_BLANKS HIST_IGNORE_SPACE HIST_NO_STORE

# export
export YSU_MESSAGE_POSITION="after"
export BAT_CONFIG_PATH="$XDG_CONFIG_HOME:-~/.config/bat.conf"
export PATH=$PATH:/usr/local/go/bin:~/.local/bin:~/.cargo/bin:/home/x/.opencode/bin:~/go/bin:~/.npm-global/bin
export EDITOR="nvim"

# zoxide load
_cache_eval zoxide zoxide init zsh --cmd z
# uv autocompletion
_cache_eval uv-comp uv generate-shell-completion zsh
_cache_eval uvx-comp uvx --generate-shell-completion zsh

# aliases
alias ls="eza --icons -a"
alias ll="eza --icons --long --header"
alias la="eza --icons --long --header --all"
alias tree="eza --tree"
sudo() {
    if (( $# == 0 )); then
        command sudo -E
    elif [[ "$1" == -* ]]; then
        command sudo "$@"
    else
        command sudo -E "$@"
    fi
}
alias leetcode="nvim leetcode.nvim"
alias rmx="trash-put"

# zvm
bindkey -v

# cd with yazi
function y() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	command yazi "$@" --cwd-file="$tmp"
	IFS= read -r -d '' cwd < "$tmp"
	rm -f -- "$tmp"
	[[ -n "$cwd" && "$cwd" != "$PWD" && -d "$cwd" ]] && builtin cd -- "$cwd"
}
