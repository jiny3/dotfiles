return {
  {
    "catppuccin/nvim",
    name = "catppuccin",
    priority = 1000,
    lazy = false,
    config = function()
      require("catppuccin").setup({
        auto_integrations = true,
      })
      vim.cmd.colorscheme("catppuccin")
    end,
  },
  {
    "nvim-lualine/lualine.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = function(_, opts)
      opts.options = vim.tbl_deep_extend("force", opts.options or {}, {
        section_separators = { left = "", right = "" },
        component_separators = "",
      })
      opts.extensions = { "lazy", "neo-tree", "toggleterm", "mason" }

      -- 新增：获取指定 section 的背景色（适配模式+主题）
      local function get_section_bg(section)
        local lualine_utils = require("lualine.utils.utils")
        local lualine_highlight = require("lualine.highlight")
        -- 获取当前模式后缀（normal/insert/visual 等）
        local mode_suffix = lualine_highlight.get_mode_suffix()
        -- 拼接高亮组名（如 lualine_a_normal）
        local hl_name = "lualine_" .. section .. mode_suffix
        -- 提取背景色（返回 16 进制值，无则返回透明）
        return lualine_utils.extract_highlight_colors(hl_name, "bg") or "none"
      end

      table.insert(opts.sections.lualine_a, 1, {
        function()
          return ""
        end,
        color = function()
          return { fg = get_section_bg("a"), bg = "none" }
        end,
        padding = { left = 0, right = 0 },
      })

      table.insert(opts.sections.lualine_z, {
        function()
          return ""
        end,
        color = function()
          return { fg = get_section_bg("a"), bg = "none" }
        end,
        padding = { left = 0, right = 0 },
      })

      return opts
    end,
  },
}
