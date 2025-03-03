import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "flash" is now active!');

  const disposable = vscode.commands.registerCommand("flash.helloWorld", () => {
    vscode.window.showInformationMessage("Hello World from neovim flash!");
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
