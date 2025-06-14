import * as vscode from 'vscode';
import vmHandler from './vmHandler';
import { createProgramCounterLabel, getProgramCounterLabel, createInstructionsExecutedLabel, getInstructionsExecutedLabel } from './debugger/statusBar';
import { RiscvDebugSession } from './debugger/debugAdapter';
import { lintDocument, validateISA, diagnosticCollection } from './riscvLinter';
import { signatureProvider } from './riscvSignature';
import { vmBinaryPath } from './config';

import { completionProvider } from './riscvCompletion';




const vmHandlerInstance = new vmHandler(vmBinaryPath, ['--vm-as-backend', '--start-vm']);


export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "riscv-debug-support" is now active!');

  createProgramCounterLabel();
  context.subscriptions.push(getProgramCounterLabel()!);

  createInstructionsExecutedLabel();
  context.subscriptions.push(getInstructionsExecutedLabel()!);




  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory('riscvSimpleDebug', new InlineDebugAdapterFactory())
  );

  const provider = new SimpleConfigurationProvider();
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider('riscvSimpleDebug', provider)
  );

  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider('riscvSimpleDebug', {
      provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        return [
          {
            name: "Launch Riscv(.s) File Debug",
            request: "launch",
            type: "riscvSimpleDebug",
            program: "${file}",
            stopOnEntry: true
          }
        ];
      }
    }, vscode.DebugConfigurationProviderTriggerKind.Initial)
  );

  vscode.debug.onDidStartDebugSession(session => {
    if (session.type === 'riscvSimpleDebug') {
      getProgramCounterLabel()?.show();
      getInstructionsExecutedLabel()?.show();
      vscode.commands.executeCommand('setContext', 'riscvDebugRunning', true);

    }
  });

  vscode.debug.onDidTerminateDebugSession(session => {
    if (session.type === 'riscvSimpleDebug') {
      getProgramCounterLabel()?.hide();
      getInstructionsExecutedLabel()?.hide();
      vscode.commands.executeCommand('setContext', 'riscvDebugRunning', false);

    }
  });
  vscode.debug.onDidChangeActiveDebugSession(session => {
    if (session && session.type === 'riscvSimpleDebug') {
      getProgramCounterLabel()?.hide();
      getInstructionsExecutedLabel()?.hide();
    }
  });

  // Register command used in configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('riscv-debug-support.riscvSimpleDebug.getProgramName', config => {
      const activeEditor = vscode.window.activeTextEditor;
      const defaultValue = activeEditor && activeEditor.document.languageId === 'riscv' && activeEditor.document.fileName.endsWith('.s')
        ? activeEditor.document.fileName
        : '';
      return vscode.window.showInputBox({
        placeHolder: "Please enter the name of a text file in the workspace folder",
        value: defaultValue
      });
    })
  );









  // Code completion provider for RISC-V assembly language
  context.subscriptions.push(completionProvider);


  // Linting and diagnostics setup

  // let diagnosticCollection = vscode.languages.createDiagnosticCollection("riscv-linter");

  // vscode.workspace.onDidChangeTextDocument(event => {
  //   if (event.document.languageId === 'riscv') {
  //     const diagnostics = lintDocument(event.document);
  //     diagnosticCollection.set(event.document.uri, diagnostics);
  //   }
  // });

  // vscode.workspace.onDidOpenTextDocument(document => {
  //   if (document.languageId === 'riscv') {
  //     const diagnostics = lintDocument(document);
  //     diagnosticCollection.set(document.uri, diagnostics);
  //   }
  //   validateISA(document, diagnosticCollection);
  // });

  context.subscriptions.push(diagnosticCollection);


  // Signature help provider for RISC-V assembly language
  // context.subscriptions.push(signatureProvider);


  vscode.commands.registerCommand("riscv-debug-support.showVmMemory", async () => {
    // if (!vmHandlerInstance.isRunning()) {
    //   vscode.window.showErrorMessage("Debug session is not running. Please start a debug session first.");
    //   return;
    // }

    const input = await vscode.window.showInputBox({
      prompt: "Enter memory range (e.g., 0x1000-0x10FF;0x10FF+25)",
      validateInput: (value: string) => {
        // const rangePattern = /^(0x[0-9A-Fa-f]+(-0x[0-9A-Fa-f]+)?|\d+\+\d+)$/;
        // const rangePattern = /^(0x[0-9A-Fa-f]+(-0x[0-9A-Fa-f]+)?|\+\d+)(;(0x[0-9A-Fa-f]+(-0x[0-9A-Fa-f]+)?|\+\d+))*$/;
        // const rangePattern = /^(0x[0-9A-Fa-f]+(?:-[0x[0-9A-Fa-f]+]|(?:\+\d+)))(;(0x[0-9A-Fa-f]+(?:-[0x[0-9A-Fa-f]+]|(?:\+\d+))))*$/;
        const rangePattern = /^(0x[0-9A-Fa-f]+(?:-0x[0-9A-Fa-f]+|\+\d+))(;(0x[0-9A-Fa-f]+(?:-0x[0-9A-Fa-f]+|\+\d+)))*$/;

        if (!rangePattern.test(value)) {
          return "Invalid format. Use '0x1000-0x10FF' or '0x10FF+25'.";
        }
        return null; 
      },
      ignoreFocusOut: true,
      placeHolder: "e.g. 0x2000-0x20FF;0x20FF+25;..."
    });

    if (input) {
      vscode.debug.activeDebugSession?.customRequest("getMemoryDump", { range: input });
    }
  });



  //================================================================================================
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('riscv-debug-support.openTerminal', () => {
  //     const pty = new VmTerminal();
  //     const terminal = vscode.window.createTerminal({ name: 'RISC-V VM', pty });
  //     terminal.show();
  //   })
  // );

  // const terminal = vscode.window.createTerminal({
  //   name: 'RISC-V VM',
  //   pty: vmTerminal
  // });
  // terminal.show();
  




}

export function deactivate() { }

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
  createDebugAdapterDescriptor(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new RiscvDebugSession(vmHandlerInstance));
  }
}

class SimpleConfigurationProvider implements vscode.DebugConfigurationProvider {
  async resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined> {
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'riscv') {
        config.type = 'riscvSimpleDebug';
        config.name = 'Launch';
        config.request = 'launch';
        config.stopOnEntry = true;
        const programPath = await vscode.commands.executeCommand<string>('riscv-debug-support.riscvSimpleDebug.getProgramName');
        if (!programPath || programPath.trim() === '') {
          await vscode.window.showWarningMessage('No program selected. Debug session cancelled.');
          return undefined;
        }
        config.program = programPath;
      }
    }

    if (
      !config.program ||
      config.program === 'riscv-debug-support.riscvSimpleDebug.getProgramName'
    ) {
      const programPath = await vscode.commands.executeCommand<string>('riscv-debug-support.riscvSimpleDebug.getProgramName');

      if (!programPath || programPath.trim() === '') {
        await vscode.window.showWarningMessage('No program selected. Debug session cancelled.');
        return undefined;
      }

      config.program = programPath;
    }



    return config;
  }
}
