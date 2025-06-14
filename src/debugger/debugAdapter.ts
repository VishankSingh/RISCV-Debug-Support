import {
  DebugSession,
  InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent, OutputEvent, InvalidatedEvent,
  Thread, StackFrame, Scope, Source, Handles, Breakpoint
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { ChildProcess } from 'child_process';
import { basename } from 'path';
import * as vscode from 'vscode';

import { diagnosticCollection } from '../riscvLinter';


import { getProgramCounterLabel, getInstructionsExecutedLabel } from './statusBar';

import { showMemoryDumpAsWebview } from '../views/showmemory';

import { terminalManager } from './terminalManager';



interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  program: string;
  stopOnEntry?: boolean;
}

interface VmHandler {
  childProcess?: ChildProcess | null;
  isRunning(): boolean;
  startProcess(): void;
  sendInput(input: string): void;
  vmExit(): void;
  vmLoad(filePath: string): void;
  vmRun(): void;
  vmDebugRun(): void;
  vmStep(): void;
  vmUndo(): void;
  vmRedo(): void;
  vmAddBreakpoint(line: number): void;
  vmRemoveBreakpoint(line: number): void;
  vmDumpMemory(ranges: string): void;
  vmGetMemoryData(address: string): Promise<string>;
  vmModifyRegister(register: string, value: string): Boolean;
  readStateJson(): { program_counter?: string; current_line?: number; current_instruction?: string; instructions_retired?: number; output_status?: string; breakpoints?: number[] };
  readRegistersJson(): { gp_registers?: any; fp_registers?: any; "control and status registers"?: any };
  readErrorsJson(): { errorCode?: number; errors?: { line: number; message: string }[] };
  readMemoryJson(): Record<string, string>;
}

export class RiscvDebugSession extends DebugSession {
  private static THREAD_ID = 1;
  private _variableHandles = new Handles<string>();
  private _currentLine = 0;
  private _sourceFile: string = '';
  private _breakpoints = new Map<string, number[]>();
  private _vmHandler: VmHandler | null = null;

  public constructor(vmHandler?: VmHandler) {
    super();
    this._vmHandler = vmHandler || null;
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
  }

  protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
    response.body = response.body || {};
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsEvaluateForHovers = true;
    response.body.supportsStepBack = true;
    response.body.supportsBreakpointLocationsRequest = true;
    response.body.supportsRestartRequest = true;
    response.body.supportTerminateDebuggee = true;
    response.body.supportsTerminateRequest = true;
    response.body.supportsSetVariable = true;

    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
    try {
      this._sourceFile = args.program;

      if (!this._vmHandler) {
        this.sendEvent(new OutputEvent('VM handler not available\n'));
        this.sendResponse(response);
        return;
      }

      if (!this._vmHandler.isRunning()) {
        this._vmHandler.startProcess();
        this.sendEvent(new OutputEvent('VM started\n'));
      } else {
        this.sendEvent(new OutputEvent('VM already running\n'));
      }

      let triedLoading = false;
      let outputBuffer = '';
      let parseHandled = false;
      let programHandled = false;

      const onData = (data: Buffer) => {
        outputBuffer += data.toString();

        if (!parseHandled && outputBuffer.includes('VM_PARSE_ERROR')) {
          parseHandled = true;
          this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
          const errorsDump = this._vmHandler?.readErrorsJson();
          const diagnostic: vscode.Diagnostic[] = [];
          if (errorsDump && errorsDump.errors && errorsDump.errors.length > 0) {
            errorsDump.errors.forEach((error: { line: number; message: string }) => {
              diagnostic.push(new vscode.Diagnostic(
                new vscode.Range(error.line - 1, 0, error.line - 1, 100),
                error.message,
                vscode.DiagnosticSeverity.Error
              ));
            });
          }
          diagnosticCollection?.set(
            vscode.Uri.file(this._sourceFile),
            diagnostic
          );
          this.sendEvent(new OutputEvent(`Parse error in ${this._sourceFile}:\n${outputBuffer}\n`));

          this.sendEvent(new TerminatedEvent());
          this.sendResponse(response);
          return;
        }

        // if (!triedLoading && outputBuffer.includes('VM_PARSE_SUCCESS')) {
        //   triedLoading = true;
        //   this.sendEvent(new OutputEvent('Program parsed successfully\n'));
        //   this._vmHandler?.vmLoad(this._sourceFile);
        //   outputBuffer = '';
        // }


        if (!triedLoading && !outputBuffer.includes('VM_PROGRAM_LOADED')) {
          this._vmHandler?.vmLoad(this._sourceFile);
          triedLoading = true;
        }

        if (triedLoading && outputBuffer.includes('VM_PROGRAM_LOADED')) {
          // handled = true;
          diagnosticCollection?.set(
            vscode.Uri.file(this._sourceFile),
            []
          );
          this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
          const state = this._vmHandler ? this._vmHandler.readStateJson() : {};
          if (state.current_line) {
            this._currentLine = state.current_line;
          }

          this.sendEvent(new OutputEvent(`Starting RISC-V debugger for: ${this._sourceFile}\n`));
          getProgramCounterLabel()!.text = `PC: ${state.program_counter ?? 0}`;
          getInstructionsExecutedLabel()!.text = `Instructions: ${state.instructions_retired ?? 0}`;
          this.restoreBreakpoints();
          this.sendEvent(new InitializedEvent());
          const reason = args.stopOnEntry ? 'entry' : 'breakpoint';
          this.sendEvent(new StoppedEvent(reason, RiscvDebugSession.THREAD_ID));
          this.sendEvent(new InitializedEvent());
          this.sendResponse(response);
          return;
        }
      };

      this._vmHandler.childProcess?.stdout?.on('data', onData);

    } catch (error) {
      response.success = false;
      response.message = `Cannot launch program: ${error}`;
      this.sendResponse(response);
    }
  }

  private updateCurrentLine(): void {
    if (this._vmHandler && this._vmHandler.isRunning()) {
      try {
        const state = this._vmHandler ? this._vmHandler.readStateJson() : {};
        if (state.current_line) {
          this._currentLine = state.current_line;
        }
      } catch (error) {
        this.sendEvent(new OutputEvent(`Error reading VM state: ${error}\n`));
      }
    }
  }

  private restoreBreakpoints(): void {
    if (!this._vmHandler || !this._sourceFile) { return; }

    const currentFile = this._sourceFile;
    const breakpoints = this._breakpoints.get(currentFile) || [];


    // for (const [file, lines] of this._breakpoints.entries()) {
    //   for (const line of lines) {
    //     try {
    //       this._vmHandler.vmAddBreakpoint(line);
    //       // this.sendEvent(new OutputEvent(`Restored breakpoint at line ${line}\n`));
    //     } catch (error) {
    //       this.sendEvent(new OutputEvent(`Failed to restore breakpoint at line ${line}: ${error}\n`));
    //     }
    //   }
    // }

    for (const line of breakpoints) {
      try {
        this._vmHandler.vmAddBreakpoint(line);
      } catch (error) {
        this.sendEvent(new OutputEvent(`Failed to restore breakpoint at line ${line}: ${error}\n`));
      }
    }


    this._breakpoints.clear();

    try {
      const state = this._vmHandler.readStateJson();
      const vmBreakpoints: number[] = state?.breakpoints || [];

      const confirmedBreakpoints: Breakpoint[] = [];

      this._breakpoints.set(currentFile, []);
      for (const bp of vmBreakpoints) {
        this._breakpoints.get(currentFile)!.push(bp);
        confirmedBreakpoints.push(new Breakpoint(true, bp));
      }

    } catch (error) {
      this.sendEvent(new OutputEvent(`Failed to read VM state for breakpoints: ${error}\n`));
    }


  }

  protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
    const path = args.source.path;
    const breakpoints: Breakpoint[] = [];
    if (!path || path !== this._sourceFile) {
      for (const bp of args.breakpoints ?? []) {
        const unverified = new Breakpoint(false, bp.line);
        breakpoints.push(unverified);
      }
      response.body = { breakpoints };
      this.sendResponse(response);
      return;
    }

    const oldBreakpoints = this._breakpoints.get(path) || [];
    for (const line of oldBreakpoints) {
      if (this._vmHandler && this._vmHandler.isRunning()) {
        this._vmHandler.vmRemoveBreakpoint(line);
      }
    }
    this._breakpoints.delete(path);


    if (args.breakpoints) {
      const lineNumbers: number[] = [];

      for (const bp of args.breakpoints) {
        const line = bp.line;

        try {
          if (this._vmHandler && this._vmHandler.isRunning()) {
            this._vmHandler.vmAddBreakpoint(line);
          }

          lineNumbers.push(line);
          breakpoints.push(new Breakpoint(true, line));
        } catch (error) {
          breakpoints.push(new Breakpoint(false, line));
          this.sendEvent(new OutputEvent(`Failed to set breakpoint at line ${line}: ${error}\n`));
        }
      }

      if (lineNumbers.length > 0) {
        this._breakpoints.set(path, lineNumbers);
      }
    }

    response.body = { breakpoints };
    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [
        new Thread(RiscvDebugSession.THREAD_ID, "RISC-V VM")
      ]
    };
    this.sendResponse(response);
  }

  protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
    this.updateCurrentLine();

    const frames = [
      new StackFrame(
        0,
        `Line ${this._currentLine}`,
        this.createSource(this._sourceFile),
        this._currentLine,
        1
      )
    ];

    response.body = {
      stackFrames: frames,
      totalFrames: 1
    };
    this.sendResponse(response);
  }

  protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
    response.body = {
      scopes: [
        new Scope("Registers", this._variableHandles.create("registers"), false),
        new Scope("VM State", this._variableHandles.create("vmstate"), false)
      ]
    };
    this.sendResponse(response);
  }

  protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
    const variables: DebugProtocol.Variable[] = [];
    const id = this._variableHandles.get(args.variablesReference);

    if (!this._vmHandler || !this._vmHandler.isRunning()) {
      response.body = { variables };
      return this.sendResponse(response);
    }

    try {
      if (id === 'vmstate') {
        const state = this._vmHandler.readStateJson();

        variables.push({
          name: 'currentLine',
          type: 'number',
          value: (state.current_line || 0).toString(),
          variablesReference: 0
        });

      } else if (id === 'registers') {
        variables.push(
          {
            name: 'General Purpose',
            type: 'group',
            value: '',
            variablesReference: this._variableHandles.create('gp_registers')
          },
          {
            name: 'Floating Point',
            type: 'group',
            value: '',
            variablesReference: this._variableHandles.create('fp_registers')
          },
          {
            name: 'Control & Status',
            type: 'group',
            value: '',
            variablesReference: this._variableHandles.create('csr_registers')
          }
        );

      } else if (id === 'gp_registers' || id === 'fp_registers' || id === 'csr_registers') {
        const state = this._vmHandler.readRegistersJson();


        let subRegs: Record<string, string> | undefined;
        if (id === 'gp_registers') { subRegs = state.gp_registers; }
        if (id === 'fp_registers') { subRegs = state.fp_registers; }
        if (id === 'csr_registers') { subRegs = state["control and status registers"]; }

        if (subRegs && typeof subRegs === 'object') {
          for (const [reg, value] of Object.entries(subRegs)) {
            variables.push({
              name: reg,
              type: 'register',
              value: value,
              variablesReference: 1
            });
          }
        }
      }
    } catch (error) {
      variables.push({
        name: 'error',
        type: 'string',
        value: `Failed to read VM state: ${error instanceof Error ? error.message : String(error)}`,
        variablesReference: 0
      });
    }

    response.body = { variables };
    this.sendResponse(response);
  }

  protected setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments): void {
    const parent = this._variableHandles.get(args.variablesReference);

    if (!this._vmHandler || !this._vmHandler.isRunning()) {
      response.success = false;
      response.message = 'VM is not running.';
      return this.sendResponse(response);
    }

    const regName = args.name;
    const newValue = args.value;

    if (parent === 'gp_registers' || parent === 'fp_registers' || parent === 'csr_registers') {
      if (regName === '0x0') {
        response.success = false;
        response.message = `Cannot modify register ${regName}.`;
        this.sendResponse(response);
        return;
      }
      const paddedValue = newValue.startsWith('0x')
        ? '0x' + newValue.slice(2).padStart(16, '0')
        : newValue;

      try {
        const success = this._vmHandler.vmModifyRegister(regName, paddedValue);

        if (!success) {
          response.success = false;
          response.message = `Failed to update register ${regName}.`;
        } else {
          response.body = { value: paddedValue };
          response.success = true;
          this.sendEvent(new InvalidatedEvent(['variables']));

        }
      } catch (err) {
        response.success = false;
        response.message = `Error modifying register ${regName}: ${err instanceof Error ? err.message : String(err)}`;
      }
      return this.sendResponse(response);
    }

    response.success = false;
    response.message = `Variable ${regName} is not editable in this context.`;
    this.sendResponse(response);
  }

  protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
    if (this._vmHandler && this._vmHandler.isRunning()) {
      this._vmHandler.vmDebugRun();

      let outputBuffer = '';
      let waitingForInput = false;

      const onData = (data: Buffer) => {
        outputBuffer += data.toString();

        const stdoutRegex = /VM_STDOUT_START([\s\S]*?)VM_STDOUT_END/g;
        let match;
        while ((match = stdoutRegex.exec(outputBuffer)) !== null) {
          const stdoutContent = match[1].trim();
          console.log(`Stdout ecall output: ${stdoutContent}`);
          // vmTerminal.printToTerminal(stdoutContent);
          terminalManager.print(stdoutContent);
          this.sendEvent(new OutputEvent(stdoutContent + '\n'));
        }

        outputBuffer = outputBuffer.replace(stdoutRegex, '');

        // Handle STDIN
        if (!waitingForInput && outputBuffer.includes('VM_STDIN_START')) {
          waitingForInput = true;
          outputBuffer = outputBuffer.replace('VM_STDIN_START', '');

          terminalManager.read().then((line: string) => {
            this._vmHandler?.sendInput('vm_stdin ' + line + '\n');
          }
          ).catch((err: Error) => {
            console.error(`Error reading input: ${err.message}`);
            terminalManager.print(`Error reading input: ${err.message}`);
          });
        }

        // Handle end of stdin
        if (waitingForInput && outputBuffer.includes('VM_STDIN_END')) {
          waitingForInput = false;
          outputBuffer = outputBuffer.replace('VM_STDIN_END', '');
          // this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
        }

        if (outputBuffer.includes('VM_STEP_COMPLETED')) {
          this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
          const state = this._vmHandler?.readStateJson();
          getProgramCounterLabel()!.text = `PC: ${state?.program_counter ?? 0}`;
          getInstructionsExecutedLabel()!.text = `Instructions: ${state?.instructions_retired ?? 0}`;
          this.sendEvent(new StoppedEvent('step', RiscvDebugSession.THREAD_ID));
          if (state?.current_line) {
            this._currentLine = state?.current_line;
          }
          this.sendResponse(response);
        }
  
        if (outputBuffer.includes('VM_LAST_INSTRUCTION_STEPPED')) {
          this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
          const state = this._vmHandler?.readStateJson();
          this._currentLine = 0;
          getProgramCounterLabel()!.text = `PC: ${state?.program_counter ?? 0}`;
          getInstructionsExecutedLabel()!.text = `Instructions: ${state?.instructions_retired ?? 0}`;
          this.sendEvent(new StoppedEvent('step', RiscvDebugSession.THREAD_ID));
          this.sendResponse(response);
        }

        if (outputBuffer.includes('VM_BREAKPOINT_HIT')) {
          this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
          const state = this._vmHandler?.readStateJson();
          if (state?.current_line) {
            this._currentLine = state?.current_line;
          }
          getProgramCounterLabel()!.text = `PC: ${state?.program_counter ?? 0}`;
          getInstructionsExecutedLabel()!.text = `Instructions: ${state?.instructions_retired ?? 0}`;
          this.sendEvent(new StoppedEvent('breakpoint', RiscvDebugSession.THREAD_ID));
          this.sendResponse(response);
          return;
        }

        if (outputBuffer.includes('VM_PROGRAM_END')) {
          this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
          this._vmHandler?.vmExit();
          this.sendEvent(new TerminatedEvent());
          this.sendResponse(response);
          return;
        }

      };

      this._vmHandler?.childProcess?.stdout?.on('data', onData);
    }
  }


  protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
    if (!this._vmHandler || !this._vmHandler.isRunning()) {
      return this.sendResponse(response);
    }

    this._vmHandler.vmStep();
    let outputBuffer = '';
    let waitingForInput = false;

    const onData = (data: Buffer) => {
      outputBuffer += data.toString();

      // Extract and emit any VM_STDOUT blocks using regex
      const stdoutRegex = /VM_STDOUT_START([\s\S]*?)VM_STDOUT_END/g;
      let match;
      while ((match = stdoutRegex.exec(outputBuffer)) !== null) {
        const stdoutContent = match[1].trim();
        terminalManager.print(stdoutContent);
        // this.sendEvent(new OutputEvent(stdoutContent + '\n'));
      }

      // Remove processed stdout blocks
      outputBuffer = outputBuffer.replace(stdoutRegex, '');

      // Handle STDIN
      if (!waitingForInput && outputBuffer.includes('VM_STDIN_START')) {
        waitingForInput = true;
        outputBuffer = outputBuffer.replace('VM_STDIN_START', '');

        terminalManager.read().then((line: string) => {
          this._vmHandler?.sendInput('vm_stdin \"' + line + '\"\n');
        }
        ).catch((err: Error) => {
          console.error(`Error reading input: ${err.message}`);
          terminalManager.print(`Error reading input: ${err.message}`);
        });
      }

      // Handle end of stdin
      if (waitingForInput && outputBuffer.includes('VM_STDIN_END')) {
        waitingForInput = false;
        outputBuffer = outputBuffer.replace('VM_STDIN_END', '');
        this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
      }

      // Handle other VM messages
      if (outputBuffer.includes('VM_STEP_COMPLETED')) {
        this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
        const state = this._vmHandler?.readStateJson();
        getProgramCounterLabel()!.text = `PC: ${state?.program_counter ?? 0}`;
        getInstructionsExecutedLabel()!.text = `Instructions: ${state?.instructions_retired ?? 0}`;
        this.sendEvent(new StoppedEvent('step', RiscvDebugSession.THREAD_ID));
        if (state?.current_line) {
          this._currentLine = state?.current_line;
        }
        return this.sendResponse(response);
      }

      if (outputBuffer.includes('VM_LAST_INSTRUCTION_STEPPED')) {
        this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
        const state = this._vmHandler?.readStateJson();
        this._currentLine = 0;
        getProgramCounterLabel()!.text = `PC: ${state?.program_counter ?? 0}`;
        getInstructionsExecutedLabel()!.text = `Instructions: ${state?.instructions_retired ?? 0}`;
        this.sendEvent(new StoppedEvent('step', RiscvDebugSession.THREAD_ID));
        return this.sendResponse(response);
      }

      if (outputBuffer.includes('VM_PROGRAM_END')) {
        this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
        this._vmHandler?.vmExit();
        this.sendEvent(new TerminatedEvent());
        return this.sendResponse(response);
      }


    };

    this._vmHandler.childProcess?.stdout?.on('data', onData);
  }

  protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
    this.nextRequest(response, args);
  }

  protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
    this.nextRequest(response, args);
  }

  protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {
    if (this._vmHandler && this._vmHandler.isRunning()) {
      this._vmHandler.vmUndo();
      const state = this._vmHandler.readStateJson();
      if (state.current_line) {
        this._currentLine = state.current_line;
      }
      getProgramCounterLabel()!.text = `PC: ${state.program_counter ?? 0}`;
      getInstructionsExecutedLabel()!.text = `Instructions: ${state.instructions_retired ?? 0}`;
      this.sendEvent(new StoppedEvent('step', RiscvDebugSession.THREAD_ID));
    }
    this.sendResponse(response);
  }

  protected restartRequest(response: DebugProtocol.RestartResponse, args: DebugProtocol.RestartArguments): void {
    if (this._vmHandler) {
      if (this._vmHandler.isRunning()) {
        this._vmHandler.vmExit();
      }

      try {
        if (!this._vmHandler) {
          this.sendEvent(new OutputEvent('VM handler not available\n'));
          this.sendResponse(response);
          return;
        }
        this._vmHandler.startProcess();

        let triedLoading = false;
        let outputBuffer = '';
        let parseHandled = false;
        let programHandled = false;
        const onData = (data: Buffer) => {
          outputBuffer += data.toString();
          if (!parseHandled && outputBuffer.includes('VM_PARSE_ERROR')) {
            parseHandled = true;
            this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
            const errorsDump = this._vmHandler?.readErrorsJson();
            const diagnostic: vscode.Diagnostic[] = [];
            if (errorsDump && errorsDump.errors && errorsDump.errors.length > 0) {
              errorsDump.errors.forEach((error: { line: number; message: string }) => {
                diagnostic.push(new vscode.Diagnostic(
                  new vscode.Range(error.line - 1, 0, error.line - 1, 100),
                  error.message,
                  vscode.DiagnosticSeverity.Error
                ));
              });
            }
            diagnosticCollection?.set(
              vscode.Uri.file(this._sourceFile),
              diagnostic
            );
            this.sendEvent(new OutputEvent(`Parse error in ${this._sourceFile}:\n${outputBuffer}\n`));
            this.sendEvent(new TerminatedEvent());
            this.sendResponse(response);
            return;
          }
          if (!triedLoading && !outputBuffer.includes('VM_PROGRAM_LOADED')) {
            this._vmHandler?.vmLoad(this._sourceFile);
            triedLoading = true;
          }
          if (triedLoading && outputBuffer.includes('VM_PROGRAM_LOADED')) {
            diagnosticCollection?.set(
              vscode.Uri.file(this._sourceFile),
              []
            );
            this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
            const state = this._vmHandler ? this._vmHandler.readStateJson() : {};
            if (state.current_line) {
              this._currentLine = state.current_line;
            }
            getProgramCounterLabel()!.text = `PC: ${state.program_counter ?? 0}`;
            getInstructionsExecutedLabel()!.text = `Instructions: ${state.instructions_retired ?? 0}`;
            this.restoreBreakpoints();
            this.sendEvent(new OutputEvent(`VM restarted: ${this._sourceFile}\n`));
            this.sendEvent(new StoppedEvent('restart', RiscvDebugSession.THREAD_ID));

            this.sendResponse(response);
            return;
          }
        };

        this._vmHandler.childProcess?.stdout?.on('data', onData);

      } catch (error) {
        response.success = false;
        response.message = `Cannot launch program: ${error}`;
        this.sendResponse(response);
      }
    }
  }

  protected terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments): void {
    if (this._vmHandler && this._vmHandler.isRunning()) {
      this._vmHandler.vmExit();
      this.sendEvent(new OutputEvent('VM stopped\n'));
    }
    this.sendEvent(new TerminatedEvent());
    this.sendResponse(response);
  }

  protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
    if (this._vmHandler && this._vmHandler.isRunning()) {
      this._vmHandler.vmExit();
      this.sendEvent(new OutputEvent('VM stopped via disconnect\n'));
    }
    this.sendResponse(response);
  }

  protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
    const expr = args.expression.trim();
    const state = this._vmHandler?.readRegistersJson();

    let result: string = '';

    try {
      if (/^x([0-9]|[1-2][0-9]|3[0-1])$/.test(expr)) {
        result = state?.gp_registers?.[expr] ?? 'undefined';
      } else if (/^f([0-9]|[1-2][0-9]|3[0-1])$/.test(expr)) {
        result = state?.fp_registers?.[expr] ?? 'undefined';
      } else if (expr.startsWith('csr.')) {
        const csrName = expr.slice(4);
        if (state && state["control and status registers"] && csrName in state["control and status registers"]) {
          result = state["control and status registers"][csrName];
        } else {
          result = 'undefined';
        }
      } else if (expr === "outputStatus") {
        const state = this._vmHandler?.readStateJson();
        result = state?.output_status ?? 'undefined';
      }

      else if (/^mem\[(0x[0-9a-fA-F]+)\]$/.test(expr)) {
        const address = expr.match(/^mem\[(0x[0-9a-fA-F]+)\]$/)?.[1];
        if (address) {
          this._vmHandler?.vmGetMemoryData(address).then(data => {
            result = data;
            response.body = {
              result: result,
              variablesReference: 0
            };
            this.sendResponse(response);
          }).catch(err => {
            response.success = false;
            response.message = `Memory read error: ${err instanceof Error ? err.message : 'Unknown error'}`;
            this.sendResponse(response);
          });
          return;
        }
      }

      else {
        throw new Error("Unknown watch expression");
      }

      response.body = {
        result: result,
        variablesReference: 0
      };
      this.sendResponse(response);
    } catch (err) {
      response.success = false;
      response.message = `Evaluation error: ${(err instanceof Error ? err.message : 'Unknown error')}`;
      this.sendResponse(response);
    }
  }

  private createSource(filePath: string): Source {
    return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'riscv-adapter-data');
  }

  private parseMemoryRanges(input: string): [string, string][] {
    const segments = input.split(';');
    const ranges: [string, string][] = [];

    for (const segment of segments) {
      if (segment.includes('-')) {
        const [startStr, endStr] = segment.split('-');
        const start = parseInt(startStr.trim(), 16);
        const end = parseInt(endStr.trim(), 16);
        let length = end - start + 1;
        if (length % 8 !== 0) {
          length += 8 - (length % 8);
        }
        length = length / 8;


        const lengthStr = length.toString(10);

        if (isNaN(start) || isNaN(end) || start > end) {
          throw new Error(`Invalid range: ${segment}`);
        }
        ranges.push([startStr.trim(), lengthStr.trim()]);
      } else if (segment.includes('+')) {
        const [startStr, lengthStr] = segment.split('+');
        const start = parseInt(startStr.trim(), 16);
        let length = parseInt(lengthStr.trim(), 10);
        if (length % 8 !== 0) {
          length += 8 - (length % 8);
        }
        length = length / 8;

        if (isNaN(start) || isNaN(length) || length <= 0) {
          throw new Error(`Invalid offset+length: ${segment}`);
        }
        ranges.push([startStr.trim(), length.toString(10).trim()]);
      } else {
        throw new Error(`Unrecognized format: ${segment}`);
      }
    }

    return ranges;
  }

  protected customRequest(command: string, response: DebugProtocol.Response, args: any, request?: DebugProtocol.Request): void {
    if (command === "getMemoryDump") {
      const range = args?.range;
      if (!range) {
        response.success = false;
        response.message = "Missing 'range' argument";
        this.sendResponse(response);
        return;
      }

      const ranges: [string, string][] = this.parseMemoryRanges(range);
      const rangesInput = ranges.map(([start, length]) => `${start} ${length}`).join(' ');
      if (!this._vmHandler || !this._vmHandler.isRunning()) {
        response.success = false;
        response.message = "VM handler not available or VM is not running";
        this.sendResponse(response);
        return;
      }

      this._vmHandler.vmDumpMemory(rangesInput);

      let outputBuffer = '';

      const onData = (data: Buffer) => {
        outputBuffer += data.toString();

        if (outputBuffer.includes('VM_MEMORY_DUMPED')) {
          this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
          const memoryDump = this._vmHandler?.readMemoryJson();
          if (memoryDump) {
            showMemoryDumpAsWebview(memoryDump);
            response.body = { success: true };
          } else {
            response.success = false;
            response.message = "Failed to read memory dump from VM";
            this.sendEvent(new OutputEvent(`Failed to read memory dump from VM\n`));
          }
        } else if (outputBuffer.includes('VM_MEMORY_DUMP_ERROR')) {
          this._vmHandler?.childProcess?.stdout?.removeListener('data', onData);
          response.success = false;
          response.message = "Error during memory dump";
          this.sendEvent(new OutputEvent(`Error during memory dump: ${outputBuffer}\n`));
        }
      };

      this._vmHandler?.childProcess?.stdout?.on('data', onData);

      response.body = { success: true };
      this.sendResponse(response);
    } else {
      super.customRequest(command, response, args, request);
    }
  }


}
