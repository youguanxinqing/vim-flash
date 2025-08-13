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
  statusBarBlock.dispose(); 
  
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

const createFlashDecorationTypes = () => {
  return {
    dim: vscode.window.createTextEditorDecorationType({
      textDecoration: `none; color: rgb(119, 119, 119);`,
    }),
    highlight: vscode.window.createTextEditorDecorationType({
      backgroundColor: "rgb(30, 144, 255)",
      color: "rgb(255, 255, 255)",
    }),
  };
};

async function enableFlashJumpState() {
  await vscode.commands.executeCommand("setContext", "flash-jump.active", true);
}

async function disableFlashJumpState() {
  await vscode.commands.executeCommand(
    "setContext",
    "flash-jump.active",
    false
  );
}

function findAllRangesByChar(
  editor: vscode.TextEditor,
  char: string
): vscode.Range[] {
  const ranges: vscode.Range[] = [];
  // start to interate the text on screen
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
      if (charEqual(content[i], char)) {
        ranges.push(
          new vscode.Range(
            new vscode.Position(line, column - 1),
            new vscode.Position(line, column)
          )
        );
      }
    }
  }
  return ranges;
}

const statusBarBlock = {
  item: (undefined as vscode.StatusBarItem | undefined),
  dispose() {
    statusBarBlock.item?.dispose();
    statusBarBlock.item = undefined;
  },
  showText(inputedChars: string[]) {
    statusBarBlock.dispose();

    statusBarBlock.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      3000
    );
    statusBarBlock.item.text = "⚡" + inputedChars.join("");
    statusBarBlock.item.show();
  },
};

async function flash(editor: vscode.TextEditor) {
  const { dim, highlight } = createFlashDecorationTypes();

  // 1. enter flash mode
  await enableFlashJumpState();
  // 2. set grey background to whole screen
  editor.setDecorations(dim, editor.visibleRanges);

  let lastRanges: vscode.Range[] | undefined;
  let lastPlaceholders: PlaceHolder[] = [];
  let inputedChars: string[] = [];

  const typeCommand = vscode.commands.registerCommand(
    "type",
    ({ text }: { text: string }) => {
      cancel = async () => {
        typeCommand.dispose();
        dim.dispose();
        highlight.dispose();
        lastPlaceholders.forEach((p) => p.decoration.dispose());
        lastPlaceholders = [];
        statusBarBlock.dispose();
        await disableFlashJumpState();
      };

      const jump = (position: vscode.Position) => {
        if (editor.selection.isEmpty) {
          editor.selection = new vscode.Selection(position, position);
        } else {
          editor.selection = new vscode.Selection(
            editor.selection.anchor,
            position
          );
        }
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      };

      if (lastPlaceholders.length === 1 && text === "\n") {
        // jump into the position when it is unique and pressing enter
        jump(lastPlaceholders[0].position);
        cancel();
        return;
      } else {
        // jump into the position of the matching placeholder
        for (const ph of lastPlaceholders) {
          if (ph.char === text) {
            jump(ph.position);
            cancel();
            return;
          }
        }
      }

      inputedChars.push(text);
      statusBarBlock.showText(inputedChars);

      // search logic
      lastPlaceholders.forEach((p) => p.decoration.dispose());
      lastPlaceholders = [];
      const ranges: vscode.Range[] = [];
      if (!lastRanges) {
        // first search on whole screen
        ranges.push(...findAllRangesByChar(editor, text));
      } else {
        // other searches in lastRanges
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
          range.start.translate(0, 1)
        );
        const highlightRange = new vscode.Range(
          range.start.translate(0, 1),
          range.end
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

      return true; // prevent default behavior
    }
  );

  // re-assign cancel command
  cancel = async () => {
    dim.dispose();
    highlight.dispose();
    typeCommand.dispose();
    statusBarBlock.dispose();
    await disableFlashJumpState();
  };
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("flash-jump.cancel", cancel_),
    vscode.commands.registerTextEditorCommand("flash-jump.flash", flash)
  );
}

export function deactivate() {}
