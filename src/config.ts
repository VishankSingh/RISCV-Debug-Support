import vscode from 'vscode';
import path from 'path';

const config = vscode.workspace.getConfiguration('riscv-debug-support');

const vmBinaryPath = config.get('vmBinaryPath') as string;

const vmBinaryDir = path.dirname(vmBinaryPath);
console.log(`VM Binary Directory: ${vmBinaryDir}`);

const workspaceFolders = vscode.workspace.workspaceFolders;
const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : '';
const vmStateDir = path.join(workspaceRoot, 'vm_state');
const registerDumpPath = path.join(vmStateDir, 'registers_dump.json');

const configIniPath = path.join(vmStateDir, 'config.ini');


export const getVmBinaryPath = () => vmBinaryPath;

export {
  vmBinaryPath,
  registerDumpPath,
  configIniPath,
  vmStateDir
};
