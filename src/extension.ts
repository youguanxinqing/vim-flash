import * as vscode from "vscode";

function charEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function createLeaderDecoration(char: string): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    before: {
      contentText: char,
      backgroundColor: "rgb(255, 105, 180)",
      color: "rgb(255, 255, 255)",
      textDecoration: `none; z-index: 1; position: absolute`,
    },
  });
}

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

const candidate = {
  // attrs
  index: 0,
  chars: "fjdksla;ghrueiwoqptyvncmx,z.b",
  // functions
  generator() {
    this.index = 0;
    return this;
  },
  next(excludeChars: Set<string>) {
    while (true) {
      const char = this.chars[this.index++];
      if (char === undefined) {
        return undefined;
      }
      if (!excludeChars.has(char)) {
        return char;
      }
    }
  },
};

async function enableFlashJumpState() {
  await vscode.commands.executeCommand("setContext", "vim-flash.active", true);
}

async function disableFlashJumpState() {
  await vscode.commands.executeCommand("setContext", "vim-flash.active", false);
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
  // attrs
  item: undefined as vscode.StatusBarItem | undefined,
  // functions
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

const searchActionObj = {
  // attrs
  editor: undefined as vscode.TextEditor | undefined,
  leaderDecoration: undefined as vscode.TextEditorDecorationType | undefined,

  currentRanges: [] as vscode.Range[],

  lastRanges: undefined as vscode.Range[] | undefined,
  lastPlaceholders: [] as PlaceHolder[],
  // functions
  mount({
    editor,
    leaderDecoration,
  }: {
    editor: vscode.TextEditor;
    leaderDecoration: vscode.TextEditorDecorationType;
  }) {
    const obj = searchActionObj;
    obj.editor = editor;
    obj.leaderDecoration = leaderDecoration;
    obj.lastRanges = undefined;
    obj.lastPlaceholders = [];
  },
  unmounted() {
    const obj = searchActionObj;
    obj.lastRanges = undefined;
    obj.lastPlaceholders.forEach((p) => p.decoration.dispose());
    obj.lastPlaceholders = [];
  },
  tryFindCharDirectly(text: string): vscode.Position | undefined {
    const obj = searchActionObj;

    // jump into the position when it is unique and pressing enter
    if (obj.lastPlaceholders.length === 1 && text === "\n") {
      return obj.lastPlaceholders[0].position;
    }

    // jump into the position of the matching placeholder
    for (const ph of obj.lastPlaceholders) {
      if (ph.char === text) {
        return ph.position;
      }
    }
  },
  findChar(char: string) {
    if (!searchActionObj.editor) {
      throw new Error("Editor is not mounted");
    }

    const obj = searchActionObj;
    // clear decorations last ranges
    obj.lastPlaceholders.forEach((p) => p.decoration.dispose());
    obj.lastPlaceholders = [];

    if (!obj.lastRanges) {
      obj.currentRanges.push(
        ...findAllRangesByChar(obj.editor as vscode.TextEditor, char)
      );
    } else {
      for (const range of obj.lastRanges) {
        const nextCharRange = range.with({
          start: range.end,
          end: range.end.translate(0, 1),
        });
        const nextChar = obj.editor!.document.getText(nextCharRange);
        if (charEqual(nextChar, char)) {
          obj.currentRanges.push(range.union(nextCharRange));
        }
      }
    }
  },
  highlightCurrentRange() {
    const obj = searchActionObj;
    if (!obj.editor) {
      throw new Error("Editor is not mounted");
    }

    // backup ranges
    obj.lastRanges = obj.currentRanges;

    // collect duplicate char
    const bannedChars = new Set<string>();
    for (const r of obj.currentRanges) {
      const nextCharRange = new vscode.Range(r.end, r.end.translate(0, 1));
      const nextChar = obj.editor.document.getText(nextCharRange).toLowerCase();
      bannedChars.add(nextChar);
    }

    const highlightRanges: vscode.Range[] = [];
    const candidator = candidate.generator();
    for (const range of this.currentRanges) {
      const placeholderChar = candidator.next(bannedChars);
      if (placeholderChar === undefined) {
        break;
      }

      const placeholderDecoration = createLeaderDecoration(placeholderChar);
      const placeholderRange = new vscode.Range(
        range.start,
        range.start.translate(0, 1)
      );
      this.lastPlaceholders.push({
        char: placeholderChar,
        position: range.start,
        decoration: placeholderDecoration,
      });

      const highlightRange = new vscode.Range(
        range.start.translate(0, 1),
        range.end
      );
      highlightRanges.push(highlightRange);

      this.editor!.setDecorations(placeholderDecoration, [placeholderRange]);
    }

    this.editor!.setDecorations(this.leaderDecoration!, highlightRanges);
  },
};

const inputedTextObj = {
  data: [] as string[],
  statusBarBlock,
  mount() {
    const obj = inputedTextObj;
    obj.statusBarBlock.showText(obj.data);
  },
  addChar(char: string) {
    const obj = inputedTextObj;
    obj.data.push(char);
    obj.statusBarBlock.showText(obj.data);
  },
  popChar() {
    const obj = inputedTextObj;
    obj.data.pop();
    obj.statusBarBlock.showText(obj.data);
  },
  unmount() {
    const obj = inputedTextObj;
    obj.data = [];
    obj.statusBarBlock.dispose();
  },
};

async function flash(editor: vscode.TextEditor) {
  const { dim, highlight } = createFlashDecorationTypes();

  // 1. enter flash mode
  await enableFlashJumpState();
  // 2. set grey background to whole screen
  editor.setDecorations(dim, editor.visibleRanges);
  // 3. display '⚡' flag
  inputedTextObj.mount();
  // 4. mount search action object
  searchActionObj.mount({ editor: editor, leaderDecoration: highlight });

  const typeCommand = vscode.commands.registerCommand(
    "type",
    ({ text }: { text: string }) => {
      cancel = async () => {
        typeCommand.dispose();
        dim.dispose();
        highlight.dispose();
        searchActionObj.unmounted();
        inputedTextObj.unmount();
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

      // fast search
      const pos = searchActionObj.tryFindCharDirectly(text);
      if (pos) {
        jump(pos);
        cancel();
        return;
      }

      inputedTextObj.addChar(text);
      // slow search
      searchActionObj.findChar(text);
      // highlight
      searchActionObj.highlightCurrentRange();
    }
  );

  // re-assign cancel command
  cancel = async () => {
    dim.dispose();
    highlight.dispose();
    typeCommand.dispose();
    searchActionObj.unmounted();
    inputedTextObj.unmount();
    await disableFlashJumpState();
  };
}

async function deleteChar() {
  inputedTextObj.popChar();
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-flash.cancel", cancel_),
    vscode.commands.registerTextEditorCommand("vim-flash.jump", flash),
    vscode.commands.registerTextEditorCommand(
      "vim-flash.deleteChar",
      deleteChar
    )
  );
}

export function deactivate() {}
