import * as vscode from "vscode";

function search(
  content: string,
  target: string,
  baseLine: number,
): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  let line = baseLine;
  let column = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") {
      line++;
      column = 0;
    } else {
      column++;
    }
    if (content[i] === target) {
      ranges.push(
        new vscode.Range(
          new vscode.Position(line, column - 1),
          new vscode.Position(line, column),
        ),
      );
    }
  }
  return ranges;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "flash" is now active!');

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand("flash.flash", (editor) => {
      const dim = vscode.window.createTextEditorDecorationType({
        color: "rgb(119, 119, 119)",
      });
      const highlight = vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 255, 0, 0.5)",
      });
      editor.setDecorations(dim, editor.visibleRanges);
      const d = vscode.commands.registerCommand(
        "type",
        ({ text }: { text: string }) => {
          console.log(editor.visibleRanges);
          const ranges = editor.visibleRanges.flatMap((range) =>
            search(editor.document.getText(range), text, range.start.line),
          );
          editor.setDecorations(highlight, ranges);
          setTimeout(() => {
            d.dispose();
            dim.dispose();
            highlight.dispose();
          }, 3000);
        },
      );
    }),
  );
}

export function deactivate() {}
