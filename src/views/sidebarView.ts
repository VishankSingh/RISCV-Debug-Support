import * as vscode from 'vscode';

class SidebarProvider {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren() {

        

        return [

        ];
    }
}
export { SidebarProvider };
