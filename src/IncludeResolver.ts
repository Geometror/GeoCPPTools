
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { stdout } from 'process'

//TODO: Cleanup(path.normalize, pack code in methods)
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
    public onDidRename(movedFileEvt: vscode.FileRenameEvent): void {

        //Check wether renames or moved files are of interest
        const watcherExtensions = this.wsConfig.get<string[]>("includeHelper.watcherExtensions",
            ["cpp", "hpp", "c", "h", "cc", "cxx", "c++", "C"])
        let cppFilesFound = false

        movedFileEvt.files.forEach((file) => {
            if (watcherExtensions.includes(path.extname(file.oldUri.fsPath).slice(1)))//Remove dot 
                cppFilesFound = true
        })

        if (!cppFilesFound)
            return

        let choice = vscode.window.showInformationMessage("C/C++ header/source files have been renamed/moved. \n" +
            "Should the paths of the include directives be adjusted?", "Yes", "No")
        choice.then((str) => {
            if (str === "Yes") {
                let rootPath = vscode.workspace.rootPath || ""
                let sourcePath = path.join(rootPath, this.wsConfig.get<string>("includeHelper.sourceFolder", "src"))
                movedFileEvt.files.forEach((movedFile) => {
                    console.log("##################################################################")
                    console.log("Processing moved file:" + movedFile.newUri)

                    //TODO: 1. Neue #include<>-Pfade für verschobene Dateien ermitteln
                    //-> Beim Verschieben müssen die #include<>-Pfade der vershobenen Dateien, die sich gegenseitig einbinden nicht angepasst werden
                    //-> Beim Umbennen jedoch schon

                    //Adjust the include directive paths for all other C++ files in the source folder
                    walkDir(sourcePath, (srcFile: string) => {
                        //Check wether current file was just moved
                        // for(let movedFile of e.files){
                        //     if(movedFile.newUri.fsPath === file)

                        //         return
                        // }
                        if (watcherExtensions.includes(path.extname(srcFile).slice(1))) {
                            this.replaceIncludePaths(srcFile, movedFile.oldUri.fsPath, movedFile.newUri.fsPath, movedFileEvt.files)
                        }
                    })
                    console.log("DONE processing moved file:" + movedFile.newUri)
                })
                vscode.window.showInformationMessage("Paths of Include directives adjusted.")
            }

        })

    }

    private replaceIncludePaths(srcFile: string,
        movedFileOldUri: string,
        movedFileNewUri: string,
        allMovedFiles: ReadonlyArray<{ oldUri: vscode.Uri, newUri: vscode.Uri }>) {

        let buffer = ""
        let lines = fs.readFileSync(srcFile, 'utf-8')
            .split('\n')

        for (const line of lines) {
            let includeRegex = new RegExp('#(| +)include(| +)"')

            //Only one match per line allowed/reasonable
            let result = includeRegex.exec(line)
            //console.log(line + "|||||" + result)
            if (result != null) {
                //Parse include directive
                console.log("------>\nFound include [SRC FILE: " + srcFile + "]")
                let pathBegIdx = line.indexOf('"')
                let PathEndIdx = line.indexOf('"', pathBegIdx + 1)
                let incPath = line.substring(pathBegIdx + 1, PathEndIdx)
                console.log("INC PATH:" + incPath)
                let srcFileDirPath = path.dirname(srcFile) + path.sep
                let oldDir = path.dirname(movedFileOldUri) + path.sep
                let pointsToFile = path.normalize(srcFileDirPath + incPath)
                let movedPointsToFile = path.normalize(oldDir + incPath)

                console.log("POINTS TO:" + pointsToFile)
                console.log("MOVED POINTS TO:" + pointsToFile)
                console.log("OLDURI (NORM):" + path.normalize(movedFileOldUri))
                console.log("NEWURI (NORM):" + path.normalize(movedFileNewUri))



                //Update path only when include path points to old location of moved file
                if (movedFileOldUri === pointsToFile) {
                    //TODO: Preserve comments after include directives
                    //TODO: Setting for brace type

                    let newIncPath = path.relative(srcFileDirPath, movedFileNewUri)

                    console.log("NEW INC PATH:" + newIncPath)

                    let newLine = line.slice(0, pathBegIdx + 1) + newIncPath + line.slice(PathEndIdx)
                    buffer += newLine + "\n"

                } else if (movedFileNewUri === srcFile) {
                    //Handling the include directive of the moved files
                    
                    //When several files are moved
                    if (allMovedFiles.length > 1) {
                        //Check if the file is part of the moved files, but not itself
                        //If file which the include path is pointing to was also moved do nothing
                        let includes = false
                        for (let fa of allMovedFiles) {
                            if (fa.oldUri.fsPath === pointsToFile || fa.oldUri.fsPath === movedPointsToFile) includes = true
                        }
                        if (includes) {
                            console.log("FILE WAS ALSO MOVED:" + pointsToFile)
                            buffer += line + "\n"
                            continue
                        }
                    }
                    //TODO: Fix changing path in a weird way

                    let newIncPath = path.relative(srcFileDirPath, movedPointsToFile)
                    console.log("[MOVED] NEW INC PATH:" + newIncPath)

                    let newLine = line.slice(0, pathBegIdx + 1) + newIncPath + line.slice(PathEndIdx)
                    buffer += newLine + "\n"
                } else {
                    buffer += line + "\n"
                }

            } else {
                buffer += line + "\n"
            }
        }

        //Read file line by line and load it into a buffer string
        console.log("FILE READ!")
        fs.writeFileSync(srcFile, buffer)
        console.log("DONE!")

    }

    dispose() {

    }

}

function walkDir(dir: string, callback: CallableFunction) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ?
            walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
};