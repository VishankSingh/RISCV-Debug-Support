import * as vscode from 'vscode';

class VmTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;

  private closeEmitter = new vscode.EventEmitter<void>();
  onDidClose?: vscode.Event<void> = this.closeEmitter.event;

  private history: string[] = [];
  private historyIndex: number = -1;
  private isReady = false;
  private lastPrintedEndedWithNewline = true;


  private inputBuffer = '';
  private inputResolvers: ((line: string) => void)[] = [];
  private pendingOutput: string[] = [];

  open(_: vscode.TerminalDimensions | undefined): void {
    // this.writeEmitter.fire('Welcome to the custom VM terminal!\r\n> ');
    this.writeEmitter.fire('RISC-V VM Terminal\r\n=> ');
    this.isReady = true;
    while (this.pendingOutput.length > 0) {
      this.writeEmitter.fire(this.pendingOutput.shift()!);
    }

  }

  close(): void {
    this.closeEmitter.fire();
  }

  private replaceCurrentLine(text: string) {
    this.writeEmitter.fire('\x1b[2K\r'); // Clear entire line
    this.inputBuffer = text;
    this.writeEmitter.fire('=> ' + text);
  }




  handleInput(data: string): void {
    if (data === '\r') {
      const line = this.inputBuffer;
      this.inputBuffer = '';

      // Clear line and show only user input
      // this.writeEmitter.fire('' + line + '\r\n');
      this.writeEmitter.fire('\r\n');

      if (line.trim() !== '') {
        this.history.push(line);
        this.historyIndex = this.history.length;
      }

      if (this.inputResolvers.length > 0) {
        const resolve = this.inputResolvers.shift();
        resolve?.(line);
      }

      if (this.inputResolvers.length === 0) {
        this.writeEmitter.fire('=> ');
      }

    } else if (data === '\x7f') {
      if (this.inputBuffer.length > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        this.writeEmitter.fire('\b \b');
      }

    } else if (data === '\x1b[A') {
      if (this.history.length > 0) {
        this.historyIndex = Math.max(0, this.historyIndex - 1);
        this.replaceCurrentLine(this.history[this.historyIndex]);
      }

    } else if (data === '\x1b[B') {
      if (this.history.length > 0) {
        this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
        const next = this.historyIndex < this.history.length ? this.history[this.historyIndex] : '';
        this.replaceCurrentLine(next);
      }

    } else {
      this.inputBuffer += data;
      this.writeEmitter.fire(data);
    }
  }

  printToTerminal(message: string): void {

    for (const char of message) {
      if (char === '\n') {
        this.lastPrintedEndedWithNewline = true;
        if (this.isReady) {
          this.writeEmitter.fire('\r\n');
        } else {
          this.pendingOutput.push('\r\n');
        }
      } else {
        this.lastPrintedEndedWithNewline = false;
        if (this.isReady) {
          this.writeEmitter.fire(char);
        } else {
          this.pendingOutput.push(char);
        }
      }
    }

    // if (this.inputResolvers.length === 0) {
    //   if (this.isReady) {
    //     this.writeEmitter.fire('=> ');
    //   } else {
    //     this.pendingOutput.push('=> ');
    //   }
    // }
  }


  readLine(): Promise<string> {
    return new Promise((resolve) => {
      this.inputResolvers.push(resolve);

      if (this.inputResolvers.length === 1) {
        if (!this.lastPrintedEndedWithNewline) {
          this.writeEmitter.fire('\r\n');
        }
        this.writeEmitter.fire('=> ');
        this.lastPrintedEndedWithNewline = false;
      }
    });
  }



}



export { VmTerminal };