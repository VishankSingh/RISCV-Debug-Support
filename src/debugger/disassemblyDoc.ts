import * as vscode from 'vscode';


/**
 * Single-file, read‑only disassembly provider.
 *
 *   ▸ `open(text: string)`      – opens (or reveals) the doc with given text
 *   ▸ `close()`                – closes the editor if it is visible
 *   ▸ `update(text: string)`   – replaces entire content (editor auto-refreshes)
 *   ▸ `highlight(line: number)`– yellow‑highlights the given 1‑based line
 */
export class DisassemblyDocument {
  private static readonly scheme = 'riscv-disasm';
  private static readonly uri = vscode.Uri.parse(`${DisassemblyDocument.scheme}:disassembly`);

  private readonly provider = new (class implements vscode.TextDocumentContentProvider {
    private _content = '';
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    setContent(t: string) {
      this._content = t;
      this._onDidChange.fire(DisassemblyDocument.uri);
    }
    provideTextDocumentContent(): string { return this._content; }
  })();

  arrowUri: vscode.Uri; // vscode.Uri, for the gutter icon

  private highlightDeco: vscode.TextEditorDecorationType;

  private lastLine = 0; // 1‑based

  constructor(context: vscode.ExtensionContext) {
    this.arrowUri = vscode.Uri.joinPath(
      context.extensionUri,   // root of your extension after install
      'media',                // adjust if you copied to a different folder
      'debug-stackframe.svg'
    );

    this.highlightDeco = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: 'rgba(255,215,0,0.25)',          // pale yellow
      // gutterIconPath: this.arrowUri,
      // gutterIconSize: 'contain'
    });

    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(DisassemblyDocument.scheme, this.provider),
      this.highlightDeco
    );
  }

  /** Open (or reveal) the disassembly view with given text */
  async open(text: string, column: vscode.ViewColumn = vscode.ViewColumn.Beside) {
    this.provider.setContent(text);
    const doc = await vscode.workspace.openTextDocument(DisassemblyDocument.uri);
    if (doc.languageId !== 'riscv-disassembly') {
      await vscode.languages.setTextDocumentLanguage(doc, 'riscv-disassembly');
    }
    
    const editor = await vscode.window.showTextDocument(doc, { preview: false, viewColumn: column, preserveFocus: true });

    // after the editor is visible, re‑apply last highlight (if any)
    if (this.lastLine > 0) {
      this.highlight(this.lastLine);
    }
  }



  /** Replace the content if the document is already open */
  update(text: string) { this.provider.setContent(text); }

  /** Close the editor tab if visible */
  // close() {
  //   const ed = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === DisassemblyDocument.uri.toString());
  //   if (ed) { void vscode.commands.executeCommand('workbench.action.closeActiveEditor', ed); }
  // }

  async close(): Promise<void> {
    const target = DisassemblyDocument.uri.toString();

    for (const group of vscode.window.tabGroups.all) {
      const tab = group.tabs.find(t => {
        const u = (t.input as any)?.uri as vscode.Uri | undefined;
        return u?.toString() === target;
      });
      if (tab) {
        await vscode.window.tabGroups.close(tab);
        return;
      }
    }
  }


  /** Highlight the specified 1‑based line number */
  highlight(line: number) {
    this.lastLine = line;
    const ed = vscode.window.visibleTextEditors
      .find(e => e.document.uri.toString() === DisassemblyDocument.uri.toString());
    if (!ed) { return; }

    if (line < 1 || line > ed.document.lineCount) {
      ed.setDecorations(this.highlightDeco, []);
      return;
    }
    const range = new vscode.Range(line - 1, 0, line - 1, 1);
    ed.setDecorations(this.highlightDeco, [range]);

    // optional: auto‑scroll
    ed.revealRange(range, vscode.TextEditorRevealType.InCenter);
  }

}

