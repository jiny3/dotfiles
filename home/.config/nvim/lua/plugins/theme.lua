return {
  {
    "projekt0n/github-nvim-theme",
    name = "github-theme",
    lazy = false,
    config = function()
      require("github-theme").setup({
        -- 可以在这里添加自定义选项
      })
      vim.cmd("colorscheme github_dark_default")
    end,
  },
}
