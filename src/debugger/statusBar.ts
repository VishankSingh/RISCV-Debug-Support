import * as vscode from 'vscode';


let programCounterLabel: vscode.StatusBarItem;

export function createProgramCounterLabel(): void {
  programCounterLabel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  programCounterLabel.text = 'PC: 0x00000000';
  programCounterLabel.tooltip = 'Current Program Counter';
  programCounterLabel.hide();
}

export function getProgramCounterLabel(): vscode.StatusBarItem | undefined {
  return programCounterLabel;
}


let instructionsExecutedLabel: vscode.StatusBarItem;

export function createInstructionsExecutedLabel(): void {
  instructionsExecutedLabel = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1);
  instructionsExecutedLabel.text = 'Instructions: 0';
  instructionsExecutedLabel.tooltip = 'Total Instructions Executed';
  instructionsExecutedLabel.hide();
}

export function getInstructionsExecutedLabel(): vscode.StatusBarItem | undefined {
  return instructionsExecutedLabel;
}
