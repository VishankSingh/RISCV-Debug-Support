import vscode from 'vscode';
import path from 'path';

const config = vscode.workspace.getConfiguration('riscv-debug-support');

const vmBinaryPath = config.get('vmBinaryPath') as string;

const vmBinaryDir = path.dirname(vmBinaryPath);
console.log(`VM Binary Directory: ${vmBinaryDir}`);
const registerDumpPath = path.join(vmBinaryDir, 'vm_state', 'registers_dump.json');

export const getVmBinaryPath = () => vmBinaryPath;

export {
  vmBinaryPath,
  registerDumpPath
};
