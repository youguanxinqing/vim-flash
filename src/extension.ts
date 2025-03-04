import * as vscode from "vscode";

function placeholder(char: string): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    before: {
      contentText: char,
      backgroundColor: "rgb(50, 205, 50)",
      color: "rgb(255, 255, 255)",
      textDecoration: `none; z-index: 1; position: absolute`,
    },
  });
}

let cancel: (() => Promise<void>) | undefined = undefined;

async function cancel_() {
  if (cancel) {
    await cancel();
    cancel = undefined;
  }
}

const a = "a".charCodeAt(0);

async function flash(editor: vscode.TextEditor) {
  const dim = vscode.window.createTextEditorDecorationType({
    textDecoration: `none; color: rgb(119, 119, 119);`,
  });
  const highlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgb(30, 144, 255)",
    color: "rgb(255, 255, 255)",
  });
  await vscode.commands.executeCommand("setContext", "flash.active", true);
  editor.setDecorations(dim, editor.visibleRanges);
  let lastRanges: vscode.Range[] | undefined;
  let lastPlaceholderDecorations: vscode.TextEditorDecorationType[] = [];
  const typeCommand = vscode.commands.registerCommand(
    "type",
    ({ text }: { text: string }) => {
      cancel = async () => {
        typeCommand.dispose();
        dim.dispose();
        highlight.dispose();
        lastPlaceholderDecorations.forEach((d) => d.dispose());
        await vscode.commands.executeCommand(
          "setContext",
          "flash.active",
          false,
        );
      };
      lastPlaceholderDecorations.forEach((d) => d.dispose());
      lastPlaceholderDecorations = [];
      const ranges: vscode.Range[] = [];
      if (!lastRanges) {
        for (const range of editor.visibleRanges) {
          const content = editor.document.getText(range);
          let line = range.start.line;
          let column = 0;
          for (let i = 0; i < content.length; i++) {
            if (content[i] === "\n") {
              line++;
              column = 0;
            } else {
              column++;
            }
            if (content[i] === text) {
              ranges.push(
                new vscode.Range(
                  new vscode.Position(line, column - 1),
                  new vscode.Position(line, column),
                ),
              );
            }
          }
        }
      } else {
        for (const range of lastRanges) {
          const nextCharRange = range.with({
            start: range.end,
            end: range.end.translate(0, 1),
          });
          const nextChar = editor.document.getText(nextCharRange);
          if (nextChar === text) {
            ranges.push(range.union(nextCharRange));
          }
        }
      }
      if (ranges.length === 1) {
        editor.selection = new vscode.Selection(ranges[0].end, ranges[0].end);
        cancel();
        return;
      }
      if (ranges.length === 0) {
        cancel();
        return;
      }
      lastRanges = ranges;
      const highlightRanges: vscode.Range[] = [];
      for (const [i, range] of ranges.entries()) {
        const placeholderChar = String.fromCharCode(a + i);
        const placeholderDecoration = placeholder(placeholderChar);
        const placeholderRange = new vscode.Range(
          range.start,
          range.start.translate(0, 1),
        );
        const highlightRange = new vscode.Range(
          range.start.translate(0, 1),
          range.end,
        );
        highlightRanges.push(highlightRange);
        lastPlaceholderDecorations.push(placeholderDecoration);
        editor.setDecorations(placeholderDecoration, [placeholderRange]);
      }
      editor.setDecorations(highlight, highlightRanges);
    },
  );
  cancel = async () => {
    dim.dispose();
    highlight.dispose();
    typeCommand.dispose();
    await vscode.commands.executeCommand("setContext", "flash.active", false);
  };
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "flash" is now active!');
  context.subscriptions.push(
    vscode.commands.registerCommand("flash.cancel", cancel_),
    vscode.commands.registerTextEditorCommand("flash.flash", flash),
  );
}

export function deactivate() {}
