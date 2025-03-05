import * as vscode from "vscode";

function charEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function placeholder(char: string): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    before: {
      contentText: char,
      backgroundColor: "rgb(255, 105, 180)",
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

type PlaceHolder = {
  char: string;
  position: vscode.Position;
  decoration: vscode.TextEditorDecorationType;
};

const placeholderChars = "fjdksla;ghrueiwoqptyvncmx,z.b";

async function flash(editor: vscode.TextEditor) {
  await vscode.commands.executeCommand("setContext", "flash-jump.active", true);
  const dim = vscode.window.createTextEditorDecorationType({
    textDecoration: `none; color: rgb(119, 119, 119);`,
  });
  const highlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgb(30, 144, 255)",
    color: "rgb(255, 255, 255)",
  });
  editor.setDecorations(dim, editor.visibleRanges);
  let lastRanges: vscode.Range[] | undefined;
  let lastPlaceholders: PlaceHolder[] = [];
  const typeCommand = vscode.commands.registerCommand(
    "type",
    ({ text }: { text: string }) => {
      cancel = async () => {
        typeCommand.dispose();
        dim.dispose();
        highlight.dispose();
        lastPlaceholders.forEach((p) => p.decoration.dispose());
        lastPlaceholders = [];
        await vscode.commands.executeCommand(
          "setContext",
          "flash-jump.active",
          false,
        );
      };
      const jump = (position: vscode.Position) => {
        if (editor.selection.isEmpty) {
          editor.selection = new vscode.Selection(position, position);
        } else {
          editor.selection = new vscode.Selection(
            editor.selection.anchor,
            position,
          );
        }
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter,
        );
      };
      if (lastPlaceholders.length === 1 && text === "\n") {
        jump(lastPlaceholders[0].position);
        cancel();
        return;
      }
      for (const ph of lastPlaceholders) {
        if (ph.char === text) {
          jump(ph.position);
          cancel();
          return;
        }
      }
      lastPlaceholders.forEach((p) => p.decoration.dispose());
      lastPlaceholders = [];
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
            if (charEqual(content[i], text)) {
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
          if (charEqual(nextChar, text)) {
            ranges.push(range.union(nextCharRange));
          }
        }
      }
      // if (ranges.length === 1) {
      //   jump(ranges[0].end);
      //   cancel();
      //   return;
      // }
      if (ranges.length === 0) {
        cancel();
        return;
      }
      lastRanges = ranges;
      const highlightRanges: vscode.Range[] = [];
      const bannedChars = new Set<string>();
      for (const r of ranges) {
        const nextCharRange = new vscode.Range(r.end, r.end.translate(0, 1));
        const nextChar = editor.document.getText(nextCharRange).toLowerCase();
        bannedChars.add(nextChar);
      }
      let i = 0;
      const nextPlaceholderChar = () => {
        while (true) {
          const placeholderChar = placeholderChars[i++];
          if (placeholderChar === undefined) {
            return undefined;
          }
          if (!bannedChars.has(placeholderChar)) {
            return placeholderChar;
          }
        }
      };
      for (const range of ranges) {
        const placeholderChar = nextPlaceholderChar();
        if (placeholderChar === undefined) {
          break;
        }
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
        lastPlaceholders.push({
          char: placeholderChar,
          position: range.start,
          decoration: placeholderDecoration,
        });
        editor.setDecorations(placeholderDecoration, [placeholderRange]);
      }
      editor.setDecorations(highlight, highlightRanges);
    },
  );
  cancel = async () => {
    dim.dispose();
    highlight.dispose();
    typeCommand.dispose();
    await vscode.commands.executeCommand(
      "setContext",
      "flash-jump.active",
      false,
    );
  };
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("flash-jump.cancel", cancel_),
    vscode.commands.registerTextEditorCommand("flash-jump.flash", flash),
  );
}

export function deactivate() {}
