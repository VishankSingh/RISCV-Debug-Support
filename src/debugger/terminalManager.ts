import * as vscode from 'vscode';
import { VmTerminal } from './vmTerminal';

class TerminalManager {
  private static instance: TerminalManager;

  private terminalInstance: vscode.Terminal | null = null;
  private vmInstance: VmTerminal | null = null;

  private constructor() {
    vscode.window.onDidCloseTerminal((closed) => {
      if (closed === this.terminalInstance) {
        this.terminalInstance = null;
        this.vmInstance = null;
      }
    });
  }

  public static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager();
    }
    return TerminalManager.instance;
  }

  private createTerminal() {
    this.vmInstance = new VmTerminal();
    this.terminalInstance = vscode.window.createTerminal({
      name: 'RISC-V VM',
      pty: this.vmInstance,
    });

    this.terminalInstance.show();
  }

  public ensureTerminal(): void {
    if (!this.terminalInstance) {
      this.createTerminal();
    }
  }

  public print(message: string): void {
    this.ensureTerminal();
    this.vmInstance?.printToTerminal(message);
  }

  public async read(): Promise<string> {
    this.ensureTerminal();
    return await this.vmInstance!.readLine();
  }

  public getVmInstance(): VmTerminal | null {
    return this.vmInstance;
  }

  public dispose(): void {
    this.terminalInstance?.dispose();
    this.terminalInstance = null;
    this.vmInstance = null;
  }
}

export const terminalManager = TerminalManager.getInstance();
