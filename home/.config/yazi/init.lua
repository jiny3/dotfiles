require("yaziline"):setup({
	color = "#ff8da1",
	secondary_color = "#88333c",
	default_files_color = "darkgray", -- color of the file counter when it's inactive
	selected_files_color = "white",
	yanked_files_color = "green",
	cut_files_color = "red",

	separator_style = "angly", -- "angly" | "curvy" | "liney" | "empty"
	separator_open = "",
	separator_close = "",
	separator_open_thin = " ",
	separator_close_thin = " ",
	separator_head = "░▒▓",
	separator_tail = "▓▒░",

	select_symbol = "",
	yank_symbol = "󰆐",

	filename_max_length = 24, -- truncate when filename > 24
	filename_truncate_length = 6, -- leave 6 chars on both sides
	filename_truncate_separator = "...",
})
require("git"):setup({
	-- Order of status signs showing in the linemode
	order = 1500,
})
require("starship"):setup({
	-- Hide flags (such as filter, find and search). This can be beneficial for starship themes
	-- which are intended to go across the entire width of the terminal.
	hide_flags = false,
	-- Whether to place flags after the starship prompt. False means the flags will be placed before the prompt.
	flags_after_prompt = true,
	-- Custom starship configuration file to use
	config_file = "~/.config/starship.toml", -- Default: nil
	-- Whether to enable support for starship's right prompt (i.e. `starship prompt --right`).
	show_right_prompt = false,
	-- Whether to hide the count widget, in case you want only your right prompt to show up. Only has
	-- an effect when `show_right_prompt = true`
	hide_count = false,
	-- Separator to place between the right prompt and the count widget. Use `count_separator = ""`
	-- to have no space between the widgets.
	count_separator = " ",
})
require("full-border"):setup()
require("copy-file-contents"):setup({
	append_char = "\n",
	notification = true,
})
require("fs-usage"):setup({
	padding = { open = "", close = "" },
})
