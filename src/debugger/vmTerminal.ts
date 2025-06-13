import * as vscode from 'vscode';

class VmTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;

  private closeEmitter = new vscode.EventEmitter<void>();
  onDidClose?: vscode.Event<void> = this.closeEmitter.event;

  private history: string[] = [];
  private historyIndex: number = -1;


  private inputBuffer = '';
  private inputResolvers: ((line: string) => void)[] = [];


  open(_: vscode.TerminalDimensions | undefined): void {
    // this.writeEmitter.fire('Welcome to the custom VM terminal!\r\n> ');
    this.writeEmitter.fire('RISC-V VM Terminal\r\n=> ');
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
      this.writeEmitter.fire('\x1b[2K\r' + line + '\r\n');

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
    this.writeEmitter.fire('\r'); 
    this.writeEmitter.fire(message + '\r\n');

    if (this.inputResolvers.length === 0) {
      this.writeEmitter.fire('=> '); // Prompt for next input
    }
  }

  readLine(): Promise<string> {
    return new Promise((resolve) => {
      this.inputResolvers.push(resolve);
      if (this.inputResolvers.length === 1) {
        this.writeEmitter.fire('\r=> ');
      }
    });
  }


}


const vmTerminal = new VmTerminal();
const terminal = vscode.window.createTerminal({ name: 'RISC-V VM', pty: vmTerminal });


export { vmTerminal, VmTerminal, terminal };