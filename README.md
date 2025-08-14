# Vim Flash (vscode extension)

Flash jump to anywhere in the editor. Inspired by the [neovim flash extension](https://github.com/folke/flash.nvim) and [vscode-extension-flash](https://github.com/bzy-debug-orgnization/vscode-extension-flash)

https://github.com/user-attachments/assets/dbb8dfe1-5f58-4e43-8475-a582595cae59



## Features

- `vim-flash.jump`: start flash jump
- `vim-flash.cancel`: cancel flash jump during input, binding to `escape` by default
- `vim-flash.deleteChar`: delete one char inputed every time and re-highlight remained input

## For vscode vim users

1. If you find this extension does not work, add following to your `settings.json`:

   ```json
     "extensions.experimental.affinity": {
       "vscodevim.vim": 1
     },
   ```

   This setting also [improves vscode vim's performance](https://github.com/VSCodeVim/Vim?tab=readme-ov-file#-faq), you might find it helpful to enable it even if you don't use this extension

2. If you find that `escape` shortcut of `vim-flash.cancel` does not work, add following to the end of your `keybindings.json`:

   ```json
     {
       "key": "escape",
       "command": "flash-jump.cancel",
       "when": "editorTextFocus && vim-flash.active"
     },
   ```

   The order matters here since the latter keybindings have higher priorities.

3. `backspace` does work after changing `when` of `extension.vim_backspace` shortcut, adding `!vim-flash.active`:

   ```plain
   "when": "editorTextFocus && vim.active && !inDebugRepl && !vim-flash.active"
   ```
