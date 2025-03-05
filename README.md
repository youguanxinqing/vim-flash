# Flash Jump

Flash jump to anywhere in the editor. Inspired by the [neovim flash extension](https://github.com/folke/flash.nvim)

<video controls muted>
  <source src="https://github.com/bzy-debug-orgnization/vscode-extension-flash/raw/refs/heads/main/assets/example.mp4" type="video/mp4"/>
</video>

## Features

- `flash-jump.flash`: start flash jump
- `flash-jump.cancel`: cancel flash jump during input, biding to `escape` by default

## For vscode vim users

1. If you find this extension does not work, add following to your `settings.json`:

   ```json
     "extensions.experimental.affinity": {
       "vscodevim.vim": 1
     },
   ```

   This setting also [improves vscode vim's performance](https://github.com/VSCodeVim/Vim?tab=readme-ov-file#-faq), you might find it helpful to enable it even if you don't use this extension

1. If you find that `escape` shortcut of `flash-jump.cancel` does not work, app following to the end of your `keybindings.json`:

   ```json
     {
       "key": "escape",
       "command": "flash-jump.cancel",
       "when": "editorTextFocus && flash-jump.active"
     },
   ```

   The order matters here since the latter keybindings have higher priorities.
