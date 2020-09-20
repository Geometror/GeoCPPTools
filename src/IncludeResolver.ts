
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'


export class IncludeResolver implements vscode.Disposable {

    private fileMovedMap: Map<string, boolean>
    private wsConfig: vscode.WorkspaceConfiguration

    public constructor(wsConfig: vscode.WorkspaceConfiguration) {
        this.fileMovedMap = new Map<string, boolean>()

        this.wsConfig = wsConfig

        //*this* has to be passed, otherwise no access to members 
        vscode.workspace.onWillRenameFiles(this.onDidRename, this)

        // vscode.workspace.onWillDeleteFiles(this.onDidDelete, this)
        // vscode.workspace.onDidCreateFiles(this.onDidCreate,this)

    }

    //When files are renamed and MOVED
    private onDidRename(e: vscode.FileRenameEvent): void {

        //Check wether renames or moved files are of interest
        const watcherExtensions = this.wsConfig.get<string[]>("includeHelper.watcherExtensions",
            ["cpp", "hpp", "c", "h", "cc", "cxx", "c++", "C"])
        let cppFilesFound = false
        e.files.forEach((file) => {
            if (watcherExtensions.includes(path.extname(file.oldUri.fsPath).slice(1)))//Remove dot 
                cppFilesFound = true
        })

        if (!cppFilesFound)
            return

        let choice = vscode.window.showInformationMessage("C/C++ header/source files have been renamed/moved. \n" +
            "Should the paths of the include directives be adjusted?", "Yes", "No")
        choice.then((str) => {
            if (str === "Yes") {
                e.files.forEach((file) => {

                    let rootPath = path.join(vscode.workspace.rootPath || "", "src")

                    //TODO: Ermitteln der oberen gemeinsamen Ebene(in spezieller Methode)
                    //-> Relative Pfade daran ausrichten

                    let commonPath = this.findCommonPath(file.oldUri.fsPath, file.newUri.fsPath)
                    vscode.window.showInformationMessage("COMMON:" + commonPath)

                    let oldPath = path.relative(rootPath, file.oldUri.fsPath)
                    let newPath = path.relative(rootPath, file.newUri.fsPath)

                    let diff = path.relative(oldPath, newPath)
                    let diffR = path.relative(newPath, oldPath)

                    vscode.window.showInformationMessage(oldPath + " --> " + newPath)
                    vscode.window.showInformationMessage("Diff: [->]" + diff + "| [<-]" + diffR)



                    //TODO: 1. Neue #include<>-Pfade für verschobene Dateien ermitteln
                    //-> Beim Verschieben müssen die #include<>-Pfade der vershobenen Dateien, die sich gegenseitig einbinden nicht angepasst werden
                    //-> Beim Umbennen jedoch schon

                    //TODO: 2. Neue #include<>-Pfade für alle anderen, unveränderten Header/Quellcodedatein ermitteln
                })
            }

        })

    }

    private findCommonPath(path1: string, path2: string): string {
        let pathReduced = ""
        let minLen = Math.min(path1.length, path2.length)
        for (let i = 0; i < minLen; i++) {
            if (path1[i] === path2[i])
                pathReduced += path1[i]
            else
                break
        }
        return pathReduced
    }

    dispose() {

    }

}