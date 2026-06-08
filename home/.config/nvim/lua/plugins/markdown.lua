return {
  {
    "tpope/vim-markdown",
    init = function()
      -- tpope/vim-markdown
      vim.g.markdown_syntax_conceal = 0
      vim.g.markdown_fenced_languages = {
        "html",
        "python",
        "bash=sh",
        "json",
        "java",
        "js=javascript",
        "sql",
        "yaml",
        "xml",
        "dockerfile",
        "rust",
        "swift",
        "javascript",
        "lua",
      }
    end,
  },
  {
    "MeanderingProgrammer/render-markdown.nvim",
    dependencies = { "nvim-treesitter/nvim-treesitter", "nvim-tree/nvim-web-devicons" },
    ---@module 'render-markdown'
    ---@type render.md.UserConfig
    opts = {
      enabled = true,
      render_modes = { "n", "c", "t" },
      file_types = { "markdown" },
      max_file_size = 10.0,
      anti_conceal = {
        enabled = true,
        above = 0,
        below = 0,
      },
      completions = {
        lsp = { enabled = true },
      },
      heading = {
        sign = false,
        render_modes = true,
        icons = { "󰲡 ", "󰲣 ", "󰲥 ", "󰲧 ", "󰲩 ", "󰲫 " },
        position = "inline",
        width = "block",
        left_margin = { 0, 2, 4, 6, 8, 10 },
        left_pad = 1,
        right_pad = 1,
        min_width = 20,
      },
      code = {
        sign = false,
        conceal_delimiters = true,
        position = "left",
        language_pad = 1,
        width = "block",
        left_pad = 2,
        right_pad = 2,
        min_width = 45,
        border = "thin",
        inline = true,
        inline_pad = 1,
      },
      bullet = {
        icons = { "●", "○", "◆", "◇" },
        right_pad = 1,
      },
      checkbox = {
        right_pad = 1,
        custom = {
          todo = { raw = "[-]", rendered = "󰥔 ", highlight = "RenderMarkdownTodo" },
          pending = { raw = "[>]", rendered = "󰦖 ", highlight = "RenderMarkdownHint" },
          cancelled = { raw = "[~]", rendered = "󰜺 ", highlight = "RenderMarkdownError" },
        },
      },
      quote = {
        icon = "▌",
        repeat_linebreak = true,
      },
      pipe_table = {
        preset = "round",
        cell = "padded",
      },
      win_options = {
        conceallevel = { default = vim.o.conceallevel, rendered = 3 },
        concealcursor = { default = vim.o.concealcursor, rendered = "" },
        breakindent = { default = vim.o.breakindent, rendered = true },
        breakindentopt = { default = vim.o.breakindentopt, rendered = "" },
        showbreak = { default = vim.o.showbreak, rendered = "  " },
      },
    },
  },
}
