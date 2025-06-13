import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { registerDumpPath } from '../config';


interface RegisterJSONData {
    gp_registers?: Record<string, string>;
    fp_registers?: Record<string, string>;
    "control and status registers"?: Record<string, string>;
}

class RegisterProvider {
    generalPurposeRegisters: { label: string; value: string }[];
    floatingPointRegisters: { label: string; value: string }[];
    csrs: Record<string, string>;
    private _onDidChangeTreeData: vscode.EventEmitter<void>;
    public onDidChangeTreeData: vscode.Event<void>;

    constructor() {
        this.generalPurposeRegisters = Array.from({ length: 32 }, (_, i) => ({
            label: `x${i}`,
            value: `0x0`,
        }));

        this.floatingPointRegisters = Array.from({ length: 32 }, (_, i) => ({
            label: `f${i}`,
            value: `0.0`,
        }));


        this.csrs = {};


        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    }

    loadFromJSON(jsonData: RegisterJSONData): void {
        for (let i = 0; i < 32; i++) {
            const label = `x${i}`;
            if (jsonData.gp_registers && jsonData.gp_registers[label]) {
                this.generalPurposeRegisters[i].value = jsonData.gp_registers[label];
            }
        }

        for (let i = 0; i < 32; i++) {
            const label = `x${i}`; 
            if (jsonData.fp_registers && jsonData.fp_registers[label]) {
                this.floatingPointRegisters[i].value = jsonData.fp_registers[label];
            }
        }

        if (jsonData["control and status registers"]) {
            this.csrs = { ...jsonData["control and status registers"] };
        }

        this._onDidChangeTreeData.fire();
    }


    updateRegister(group: 'generalPurpose' | 'floatingPoint', index: number, newValue: string): void {
        if (group === 'generalPurpose') {
            this.generalPurposeRegisters[index].value = newValue;
        } else if (group === 'floatingPoint') {
            this.floatingPointRegisters[index].value = newValue;
        }
        this._onDidChangeTreeData.fire();
    }
    

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element: GroupItem | undefined): Promise<vscode.TreeItem[]> {
        if (!element) {
            return Promise.resolve([
                new GroupItem('General Purpose Registers', this.generalPurposeRegisters),
                new GroupItem('Floating Point Registers', this.floatingPointRegisters),
            ]);
        }

        if (element.children) {
            return Promise.resolve(
                element.children.map(
                    (register: { label: string; value: string }) => new RegisterItem(register.label, register.value)
                )
            );
        }

        return Promise.resolve([]);
    }

}

class GroupItem extends vscode.TreeItem {
    children: { label: string; value: string }[];

    constructor(label: string, children: { label: string; value: string }[]) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.children = children;
        this.contextValue = 'groupItem';
    }
}

class RegisterItem extends vscode.TreeItem {
    constructor(label: string, value: string) {
        super(`${label}: ${value}`, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'registerItem';
        this.label = `${label}: ${value}`;
    }
}

const registerProviderDataUpdate = (registerProviderInstance: RegisterProvider) => {
    setTimeout(() => {
        const jsonStr = fs.readFileSync(registerDumpPath, 'utf-8');
        const jsonData = JSON.parse(jsonStr);
        registerProviderInstance.loadFromJSON(jsonData);
    }, 200);
};
  

export { RegisterProvider, registerProviderDataUpdate };