import * as vscode from 'vscode'

export class ExtensionModule {

    protected static cfg: vscode.WorkspaceConfiguration
    protected extContext: vscode.ExtensionContext

    public constructor(context: vscode.ExtensionContext){
        if(!vscode.workspace.getConfiguration("geocpptools")){
            console.log("CONFIG UNDEFINED")
        }
        console.log("CONSTRUCTOR")
        ExtensionModule.cfg = vscode.workspace.getConfiguration("geocpptools")
        this.extContext = context
        vscode.workspace.onDidChangeConfiguration(this.updateConfig)
    }

    //Keep cached configuration up to date
    public updateConfig() {
        console.log("Config changed.")
        ExtensionModule.cfg = vscode.workspace.getConfiguration("geocpptools")
    }

    public getConfig(){
        return vscode.workspace.getConfiguration("geocpptools");
    }
}