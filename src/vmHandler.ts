import { spawn } from 'child_process';
import path from 'path';
import * as fs from 'fs';
import * as ini from 'ini';
import * as vscode from 'vscode';


import { vmBinaryPath, configIniPath, vmStateDir } from './config';

class vmHandler {
  executablePath: string;
  args: string[];
  childProcess: any;
  private isVmRunning: boolean;

  constructor(executablePath: string, args: string[] = []) {
    this.executablePath = executablePath;
    this.args = args;
    this.childProcess = null;
    this.isVmRunning = false;
  }

  isRunning(): boolean {
    return this.isVmRunning;
  }

  readStateJson() {
    const vmStateDump = path.join(vmStateDir, 'vm_state_dump.json');
    const content = fs.readFileSync(vmStateDump, 'utf8');
    return JSON.parse(content);
  }

  readRegistersJson() {
    const vmRegistersDump = path.join(vmStateDir, 'registers_dump.json');
    const content = fs.readFileSync(vmRegistersDump, 'utf8');
    return JSON.parse(content);
  }

  readErrorsJson() {
    const vmErrorsDump = path.join(vmStateDir, 'errors_dump.json');
    const content = fs.readFileSync(vmErrorsDump, 'utf8');
    return JSON.parse(content);
  }

  readMemoryJson() {
    const vmMemoryDump = path.join(vmStateDir, 'memory_dump.json');
    const content = fs.readFileSync(vmMemoryDump, 'utf8');
    return JSON.parse(content);
  }

  readDisassembly() {
    const disassemblyFile = path.join(vmStateDir, 'disassembly.txt');
    if (fs.existsSync(disassemblyFile)) {
      const content = fs.readFileSync(disassemblyFile, 'utf8');
      console.log('Disassembly content:', content);
      return content;
      // return content
      //   .split('\n')
      //   .map(line => line.trim())
      //   .filter(line => line.length > 0)
      //   .filter(line => !/^([0-9a-fA-F]+)\s+<.*>:$/.test(line))
      //   .join('\n');
    }
    return '';
  }

  readDisassemblyArray(): Array<{ address: number; text: string }> {
    const disassemblyFile = path.join(vmStateDir, 'disassembly.txt');
    if (fs.existsSync(disassemblyFile)) {
      const content = fs.readFileSync(disassemblyFile, 'utf8');
      console.log('Disassembly content:', content);
      // return content;
      // return [{ address: 0, text: "text" }];
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          // Example line: "0x00000000: addi x1, x0, 5"
          // if (
          //   /^([0-9a-fA-Fx]16):\s1<.*>:$/.test(line) 
          //   // || // e.g. 0000000000000034 <test>:
          //   // /^address\s+<.*>:$/.test(line)              // e.g. address <label>:
          // ) {
          //   return null;
          // }
          // const match = line.match(/^\s*([0-9a-fA-F]+):\s+([0-9a-fA-F]{8})\s+(.*)$/);
          // const match2 = line.match(/^([0-9a-fA-Fx]+)\s+<.*>:/);
          // if (match) {
          //   const address = parseInt(match[1], 16);
          //   const text = match[2] + ' ' + match[3];
          //   return { address, text };
          // } else {
          //   // If parsing fails, use 0 as address and the whole line as text
          //   return { address: 0, text: line };
          // }
          const match = line.match(/^([0-9a-fA-F]+):\s+([0-9a-fA-F]{8})\s+(.*)$/);
          if (match) {
            const address = parseInt(match[1], 16);
            const text = match[2] + ' ' + match[3];
            return { address, text };
          }

          // Skip labels like "0000000000000034 <test>:"
          const labelMatch = line.match(/^[0-9a-fA-F]+ <.*>:/);
          if (labelMatch) {return null;}

          // Skip unrecognized lines
          return null;

        })
        .filter((item): item is { address: number; text: string } => item !== null);
    }
    return [];
  }


  startProcess(): Promise<void> {
    // const cwd = path.dirname(this.executablePath);
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(this.executablePath);


    this.childProcess = spawn(this.executablePath, this.args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return new Promise<void>((resolve) => {
      this.childProcess.stdout.on('data', (data: Buffer) => {
        const output: string = data.toString();
        console.log(`stdout: ${output}`);

        if (output.includes('VM_STARTED')) {
          this.isVmRunning = true;
          const run_step_delay = vscode.workspace.getConfiguration('riscv-debug-support').get('Execution.runStepDelay');
          this.sendInput(`modify_config Execution run_step_delay ${run_step_delay}`);

          const data_section_start = vscode.workspace.getConfiguration('riscv-debug-support').get('Memory.dataSectionStart');
          this.sendInput(`modify_config Memory data_section_start ${data_section_start}`);
          resolve();
        }
      });

      this.childProcess.stderr.on('data', (data: Buffer) => {
        console.error(`stderr: ${data.toString()}`);
      });

      this.childProcess.on('error', (err: Error) => {
        console.error(`Failed to start process: ${err.message}`);
      });

      this.childProcess.on('close', (code: number) => {
        console.log(`Child process exited with code ${code}`);
        this.isVmRunning = false;
      });
    });
  }



  sendInput(input: string): void {
    if (this.isRunning() && this.isVmRunning) {
      this.childProcess.stdin.write(input + '\n');
    } else {
      console.error('Child process is not running or stdin is not writable.');
    }
  }

  stopProcess(): void {
    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
      console.log('Child process terminated.');
    } else {
      console.error('Child process is not running.');
    }
  }

  vmLoad(binaryPath: string): void {
    if (this.childProcess) {
      this.sendInput(`load ${binaryPath}`);
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }

  vmRun(): void {
    if (this.childProcess) {
      this.sendInput('run');
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }

  vmDebugRun(): void {
    if (this.childProcess) {
      this.sendInput('run_debug');
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }

  vmStop(): void {
    if (this.childProcess) {
      this.sendInput('stop');
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }

  vmStep(): void {
    if (this.isRunning()) {
      this.sendInput('step');
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }
  vmUndo(): void {
    if (this.childProcess) {
      this.sendInput('undo');
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }
  vmRedo(): void {
    if (this.childProcess) {
      this.sendInput('redo');
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }

  vmAddBreakpoint(line: number): void {
    if (this.childProcess) {
      this.sendInput(`add_breakpoint ${line}`);
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }

  vmRemoveBreakpoint(line: number): void {
    if (this.childProcess) {
      this.sendInput(`remove_breakpoint ${line}`);
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }

  vmDumpMemory(ranges: string): void {
    if (this.childProcess) {
      this.sendInput(`dump_mem ${ranges}`);
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }

  vmExit(): void {
    if (this.childProcess) {
      this.sendInput('exit');
      this.isVmRunning = false;
      this.stopProcess();
    } else {
      console.error('Child process is not running. Start the process first.');
    }
  }

  vmGetMemoryData(address: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.childProcess) {
        this.sendInput(`get_mem_point ${address}`);

        const onData = (data: Buffer) => {
          const output: string = data.toString();
          const match = output.match(new RegExp(`${address}\\[(.*?)\\]`));
          if (match) {
            const memoryData = match[1];
            this.childProcess.stdout.removeListener('data', onData);
            resolve(memoryData);
          }
        };

        this.childProcess.stderr.on('data', onData);
      } else {
        reject(new Error('Child process is not running. Start the process first.'));
      }
    });
  }

  vmModifyRegister(register: string, value: string): Boolean {
    if (this.childProcess) {
      this.sendInput(`modify_register ${register} ${value}`);

      const onData = (data: Buffer) => {
        const output: string = data.toString();
        if (output.includes('VM_MODIFY_REGISTER_SUCCESS')) {
          this.childProcess.stdout.removeListener('data', onData);
          return true;
        } else if (output.includes('VM_MODIFY_REGISTER_FAILURE')) {
          this.childProcess.stdout.removeListener('data', onData);
          return false;
        }
      };

      this.childProcess.stdout.on('data', onData);
    } else {
      console.error('Child process is not running. Start the process first.');
      return false;
    }
    return true;
  }



}

export default vmHandler;