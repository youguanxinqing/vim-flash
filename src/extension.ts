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
  // methods
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

async function startVimFlash(editor: vscode.TextEditor) {
  await vscode.commands.executeCommand("setContext", "vim-flash.active", true);

  const bgDecoration = vscode.window.createTextEditorDecorationType({
    textDecoration: `none; color: rgb(119, 119, 119);`,
  });
  // set grey background to whole screen
  editor.setDecorations(bgDecoration, editor.visibleRanges);

  return async () => {
    bgDecoration.dispose();
    await vscode.commands.executeCommand(
      "setContext",
      "vim-flash.active",
      false
    );
  };
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

function findAllRangesByCharArray(
  editor: vscode.TextEditor,
  charArray: string[]
): vscode.Range[] {
  if (charArray.length === 0) {
    return [];
  }

  // 先查第一个字符的所有位置
  let ranges = findAllRangesByChar(editor, charArray[0]);

  // 依次查找后续字符
  for (let i = 1; i < charArray.length; i++) {
    const nextChar = charArray[i];
    const nextRanges: vscode.Range[] = [];
    for (const range of ranges) {
      // 下一个字符必须紧跟在当前 range 后面
      const nextCharRange = new vscode.Range(
        range.end,
        range.end.translate(0, 1)
      );
      const char = editor.document.getText(nextCharRange);
      if (charEqual(char, nextChar)) {
        // 合并成更长的 range
        nextRanges.push(new vscode.Range(range.start, nextCharRange.end));
      }
    }
    ranges = nextRanges;
    if (ranges.length === 0) {
      break;
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
      vscode.StatusBarAlignment.Left
    );
    statusBarBlock.item.text = "⚡" + inputedChars.join("");
    statusBarBlock.item.show();
  },
};

const searchActionObj = {
  // attrs
  editor: undefined as vscode.TextEditor | undefined,
  normalHighlightDecoration: undefined as
    | vscode.TextEditorDecorationType
    | undefined,

  currentRanges: [] as vscode.Range[],

  lastRanges: undefined as vscode.Range[] | undefined,
  lastPlaceholders: [] as PlaceHolder[],
  // methods
  mount(editor: vscode.TextEditor) {
    this.editor = editor;

    this.normalHighlightDecoration =
      vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgb(30, 144, 255)",
        color: "rgb(255, 255, 255)",
      });
    this.lastRanges = undefined;
    this.lastPlaceholders = [];
  },
  unmount() {
    this.lastRanges = undefined;

    this.lastPlaceholders.forEach((p) => p.decoration.dispose());
    this.lastPlaceholders = [];

    this.normalHighlightDecoration?.dispose();
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
  clearScreen() {
    this.lastRanges = undefined;
    this.lastPlaceholders.forEach((p) => p.decoration.dispose());
    this.lastPlaceholders = [];
  },
  findChar(char: string) {
    if (!this.editor) {
      throw new Error("Editor is not mounted");
    }

    // clear decorations last ranges
    this.lastPlaceholders.forEach((p) => p.decoration.dispose());
    this.lastPlaceholders = [];
    // clear current ranges
    this.currentRanges = [];

    if (!this.lastRanges || this.lastRanges.length === 0) {
      this.currentRanges.push(
        ...findAllRangesByChar(this.editor as vscode.TextEditor, char)
      );
    } else {
      for (const range of this.lastRanges) {
        const nextCharRange = range.with({
          start: range.end,
          end: range.end.translate(0, 1),
        });
        const nextChar = this.editor!.document.getText(nextCharRange);
        if (charEqual(nextChar, char)) {
          this.currentRanges.push(range.union(nextCharRange));
        }
      }
    }
  },
  reFindChars(inputedChars: string[]) {
    if (!this.editor) {
      throw new Error("Editor is not mounted");
    }

    this.lastRanges = undefined;

    // clear decorations last ranges
    this.lastPlaceholders.forEach((p) => p.decoration.dispose());
    this.lastPlaceholders = [];

    this.currentRanges = findAllRangesByCharArray(this.editor, inputedChars);
  },
  highlightCurrentRange() {
    if (!this.editor) {
      throw new Error("Editor is not mounted");
    }

    // backup ranges
    this.lastRanges = this.currentRanges;

    // collect replicate char
    const bannedChars = new Set<string>();
    for (const r of this.currentRanges) {
      const nextCharRange = new vscode.Range(r.end, r.end.translate(0, 1));
      const nextChar = this.editor.document
        .getText(nextCharRange)
        .toLowerCase();
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

    this.editor!.setDecorations(
      this.normalHighlightDecoration!,
      highlightRanges
    );
  },
};

const inputedTextObj = {
  // attrs
  data: [] as string[],
  statusBarBlock: {} as typeof statusBarBlock,
  searchActionObj: {} as typeof searchActionObj,
  // methods
  mount({
    statusBarBlock,
    searchActionObj,
  }: {
    statusBarBlock: any;
    searchActionObj: any;
  }) {
    this.statusBarBlock = statusBarBlock;
    this.searchActionObj = searchActionObj;

    this.statusBarBlock.showText(this.data);
  },
  addChar(char: string) {
    this.data.push(char);
    this.statusBarBlock.showText(this.data);

    this.searchActionObj.findChar(char);
    this.searchActionObj.highlightCurrentRange();
  },
  popChar() {
    this.data.pop();
    this.statusBarBlock.showText(this.data);

    // re-highlight current range
    if (this.data.length > 0) {
      this.searchActionObj.reFindChars(this.data);
      this.searchActionObj.highlightCurrentRange();
    } else {
      this.searchActionObj.clearScreen();
    }
  },
  unmount() {
    this.data = [];
    this.statusBarBlock.dispose();
    this.searchActionObj.unmount();
  },
};

let flashActive = false;

async function flash(editor: vscode.TextEditor) {
  // check active
  if (flashActive) {
    return;
  }
  flashActive = true;

  // 1. enter flash mode
  const endVimFlash = await startVimFlash(editor);
  // 2. mount search action object
  searchActionObj.mount(editor);
  // 3. display '⚡' flag
  inputedTextObj.mount({ statusBarBlock, searchActionObj });

  const typeCommand = vscode.commands.registerCommand(
    "type",
    ({ text }: { text: string }) => {
      cancel = async () => {
        typeCommand.dispose();
        inputedTextObj.unmount();
        flashActive = false;
        await endVimFlash();
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

        return Promise.resolve();
      };

      try {
        // fast search
        const pos = searchActionObj.tryFindCharDirectly(text);
        if (pos) {
          jump(pos).then(cancel);
          return;
        }
        // slow search and highlight
        inputedTextObj.addChar(text);
      } catch (error) {
        // clean all resources if panic
        cancel();
      }
    }
  );

  // re-assign cancel command
  cancel = async () => {
    typeCommand.dispose();
    inputedTextObj.unmount();
    flashActive = false;
    await endVimFlash();
  };
}

async function deleteChar() {
  inputedTextObj.popChar();
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("vim-flash.cancel", cancel_),
    vscode.commands.registerTextEditorCommand("vim-flash.jump", flash),
    vscode.commands.registerCommand("vim-flash.deleteChar", deleteChar)
  );
}

export function deactivate() {}
