local leet_arg = "leetcode.nvim"
return {
  "kawre/leetcode.nvim",
  build = ":TSUpdate html", -- if you have `nvim-treesitter` installed
  dependencies = {
    -- include a picker of your choice, see picker section for more details
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
    "nvim-tree/nvim-web-devicons",
    "3rd/image.nvim",
  },
  lazy = leet_arg ~= vim.fn.argv(0, -1),
  opts = {
    -- configuration goes here
    arg = leet_arg,
    lang = "golang",
    cn = {
      enabled = true,
    },
    storage = {
      home = vim.fn.stdpath("data") .. "/leetcode",
      cache = vim.fn.stdpath("data") .. "/leetcode",
    },
    image_support = true,
    injector = {
      ["golang"] = {
        imports = function()
          return { "package leetcode" }
        end,
      },
    },
  },
}
