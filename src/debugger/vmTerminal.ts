import * as vscode from 'vscode';

// const { version } = require('../package.json');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  clearLine: '\x1b[2K\r',
};


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
  private cursorIndex: number = 0;
  private inputResolvers: ((line: string) => void)[] = [];
  private pendingOutput: string[] = [];

  private static readonly PROMPT = `${ANSI.green}=> ${ANSI.reset}`;


  open(_: vscode.TerminalDimensions | undefined): void {
    const banner = [
      `${ANSI.cyan}`,
      '                       .',
      '                       M',
      '                      dM',
      '                      MMr',
      '                     4MMML                  .',
      '                     MMMMM.                xf',
      '     .              "MMMMM               .MM-',
      '      Mh..          +MMMMMM            .MMMM',
      '      .MMM.         .MMMMML.          MMMMMh',
      '       )MMMh.        MMMMMM         MMMMMMM',
      '        3MMMMx.     \'MMMMMMf      xnMMMMMM"',
      '        \'*MMMMM      MMMMMM.     nMMMMMMP"',
      '          *MMMMMx    "MMMMM\\    .MMMMMMM=',
      '           *MMMMMh   "MMMMM"   JMMMMMMP',
      '             MMMMMM   3MMMM.  dMMMMMM            .',
      '              MMMMMM  "MMMM  .MMMMM(        .nnMP"',
      '  =..          *MMMMx  MMM"  dMMMM"    .nnMMMMM*"',
      '    "MMn...     \'MMMMr \'MM   MMM"   .nMMMMMMM*"',
      '     "4MMMMnn..   *MMM  MM  MMP"  .dMMMMMMM""',
      '       ^MMMMMMMMx.  *ML "M .M*  .MMMMMM**"',
      '          *PMMMMMMhn. *x > M  .MMMM**""',
      '             ""**MMMMhx/.h/ .=*"',
      '                      .3P"%....',
      '                    nP"     "*MMnx               ',
      '',
      // `${ANSI.reset}`,
      `${ANSI.yellow}RISC-V VM Terminal v1.0.1${ANSI.reset}`,
      // `${ANSI.yellow}Author:${ANSI.reset}    Vishank Singh, https://github.com/VishankSingh`,
      // `${ANSI.yellow}Docs:${ANSI.reset}      https://example.com/docs`,
      // `${ANSI.yellow}[Virtual machine src]${ANSI.reset} https://github.com/VishankSingh/riscv-simulator-2`,
      // `${ANSI.yellow}[VSCode Extension src]${ANSI.reset} https://github.com/VishankSingh/RISCV-Debug-Support`,
      '',
      // `${ANSI.green}Type 'help' to get started.${ANSI.reset}`,
      `${ANSI.green}Press ↑↓ to browse history.${ANSI.reset}`,
      '',

    ].join('\r\n');



    // this.writeEmitter.fire('RISC-V VM Terminal\r\n=> ');
    this.writeEmitter.fire(banner);
    this.isReady = true;
    while (this.pendingOutput.length > 0) {
      this.writeEmitter.fire(this.pendingOutput.shift()!);
    }

    this.writeEmitter.fire(VmTerminal.PROMPT);


  }

  close(): void {
    this.closeEmitter.fire();
  }

  private replaceCurrentLine(text: string) {
    this.writeEmitter.fire(ANSI.clearLine);
    this.inputBuffer = text;
    // this.writeEmitter.fire('=> ' + text);
    this.writeEmitter.fire(VmTerminal.PROMPT + text);

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
      // if (line.trim() === 'clear') {
      //   this.writeEmitter.fire('\x1b[2J\x1b[0f'); // Clear screen
      //   this.writeEmitter.fire('RISC-V VM Terminal\r\n=> ');
      //   this.inputBuffer = '';
      //   this.lastPrintedEndedWithNewline = false;
      //   return;
      // }

      // if (this.inputResolvers.length > 0) {
      //   const resolve = this.inputResolvers.shift();
      //   resolve?.(line);
      // }


      if (this.inputResolvers.length > 0) {
        const resolve = this.inputResolvers.shift();
        resolve?.(line);
      }

      if (this.inputResolvers.length === 0) {
        // this.writeEmitter.fire('=> ');
        this.writeEmitter.fire(VmTerminal.PROMPT);

      }

      this.cursorIndex = 0;
    } else if (data === '\x7f') { // Handle backspace
      // if (this.inputBuffer.length > 0) {
      //   this.inputBuffer = this.inputBuffer.slice(0, -1);
      //   this.writeEmitter.fire('\b \b');
      // }
      if (this.cursorIndex > 0) {
        this.inputBuffer =
          this.inputBuffer.slice(0, this.cursorIndex - 1) +
          this.inputBuffer.slice(this.cursorIndex);
        this.cursorIndex--;
        this.redrawInputBuffer();
      }


    } else if (data === '\x1b[A') { // Handle up arrow
      if (this.history.length > 0) {
        this.historyIndex = Math.max(0, this.historyIndex - 1);
        this.replaceCurrentLine(this.history[this.historyIndex]);
      }

    } else if (data === '\x1b[B') { // Handle down arrow
      if (this.history.length > 0) {
        this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
        const next = this.historyIndex < this.history.length ? this.history[this.historyIndex] : '';
        this.replaceCurrentLine(next);
      }

    } else if (data === '\x1b[D') { // Left arrow
      if (this.cursorIndex > 0) {
        this.cursorIndex--;
        this.writeEmitter.fire('\x1b[D'); // Move cursor left
      }

    } else if (data === '\x1b[C') { // Right arrow
      if (this.cursorIndex < this.inputBuffer.length) {
        this.cursorIndex++;
        this.writeEmitter.fire('\x1b[C'); // Move cursor right
      }

    }

    else {
      // this.inputBuffer += data;
      // this.writeEmitter.fire(data);
      this.inputBuffer =
        this.inputBuffer.slice(0, this.cursorIndex) +
        data +
        this.inputBuffer.slice(this.cursorIndex);

      this.cursorIndex++;

      this.redrawInputBuffer();

    }
  }

  printToTerminal(message: string): void {

    for (const char of message) {
      const toWrite = (char === '\n') ? '\r\n' : char;
      this.lastPrintedEndedWithNewline = (char === '\n');
      if (this.isReady) {
        this.writeEmitter.fire(toWrite);
      } else {
        this.pendingOutput.push(toWrite);
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

  private redrawInputBuffer() {
    this.writeEmitter.fire(ANSI.clearLine);
    this.writeEmitter.fire(VmTerminal.PROMPT + this.inputBuffer);

    const promptLength = 3;
    const moveLeft = this.inputBuffer.length - this.cursorIndex;
    if (moveLeft > 0) {
      this.writeEmitter.fire(`\x1b[${moveLeft}D`);
    }
  }



  readLine(): Promise<string> {
    return new Promise((resolve) => {
      this.inputResolvers.push(resolve);

      if (this.inputResolvers.length === 1) {
        if (!this.lastPrintedEndedWithNewline) {
          this.writeEmitter.fire('\r\n');
        }
        // this.writeEmitter.fire('=> ');
        this.writeEmitter.fire(VmTerminal.PROMPT);
        this.lastPrintedEndedWithNewline = false;
      }
    });
  }



}



export { VmTerminal };