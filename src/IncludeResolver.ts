
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
    private onDidRename(movedFileEvt: vscode.FileRenameEvent): void {

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
                movedFileEvt.files.forEach((movedFile) => {
                    console.log("Processing moved file:" + movedFile.newUri)
                    let rootPath = vscode.workspace.rootPath || ""
                    let sourcePath = path.join(rootPath, this.wsConfig.get<string>("includeHelper.sourceFolder", "src"))

                    //TODO: Ermitteln der oberen gemeinsamen Ebene(in spezieller Methode)
                    //-> Relative Pfade daran ausrichten

                    // let commonPath = this.findCommonPath(movedFile.oldUri.fsPath, movedFile.newUri.fsPath)

                    // let oldPathRel = path.relative(commonPath, movedFile.oldUri.fsPath)
                    // let newPathRel = path.relative(commonPath, movedFile.newUri.fsPath)

                    // //Möglich: let movePathRel = this.relativeMovePath(oldPathRel, newPathRel)
                    // let movePathRel = this.relativeMovePath(movedFile.oldUri.fsPath, movedFile.newUri.fsPath)
                    //vscode.window.showInformationMessage("COMMON:" + commonPath)

                    //Check if file has just been renamed
                    // if (!movePathRel.startsWith(path.sep) && !movePathRel.startsWith('.')) {
                    //     //Eigentlich nicht nötig, da nur eine Datei gleichzeitig umbenannt werden kann
                    // }

                    // let diffR = path.relative(newPathRel, oldPathRel)

                    // vscode.window.showInformationMessage(oldPathRel + " --> " + newPathRel)
                    // vscode.window.showInformationMessage("Difference: " + movePathRel)

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
                            this.replaceIncludePaths(srcFile, movedFile.oldUri.fsPath, movedFile.newUri.fsPath)
                        }
                    })
                    console.log("DONE processing moved file:" + movedFile.newUri)
                })
            }

        })

    }

    private replaceIncludePaths(srcFile: string, movedFileOldUri: string, movedFileNewUri: string) {
        const { once } = require('events');

        const fileRd = readline.createInterface({
            input: fs.createReadStream(srcFile)
        });

        //Read file line by line and load it into a buffer string
        let buffer = ""
        fileRd.on('line', (line: string) => {
            let includeRegex = new RegExp('#(| +)include(| +)"')

            //Only one match per line allowed/reasonable
            let result = includeRegex.exec(line)
            //console.log(line + "|||||" + result)
            if (result != null) {
                //Parse include directive
                console.log("Found include! idx=" + result.index + "in file " + srcFile)
                let pathBegIdx = line.indexOf('"')
                let PathEndIdx = line.indexOf('"', pathBegIdx + 1)
                let incPath = line.substring(pathBegIdx + 1, PathEndIdx)
                console.log("INC PATH:" + incPath)
                let srcFileDirPath = path.dirname(srcFile) + path.sep
                console.log("SRC FILE DIR:" + srcFileDirPath)
                let pointsToFile = path.normalize(srcFileDirPath + incPath)
                console.log("POINTS TO (NORM):" + pointsToFile)
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
                    let oldDir = path.dirname(movedFileOldUri) + path.sep
                    let pointsToFile = path.normalize(oldDir + incPath)
                    console.log("[MOVED]POINTS TO:" + pointsToFile)
                    let newIncPath = path.relative(srcFileDirPath, pointsToFile)
                    console.log("[MOVED] NEW INC PATH:" + newIncPath)

                    // if (path.normalize(path.dirname(srcFile)) === path.normalize(path.dirname(movedFileOldUri)))
                    // newIncPath = newIncPath.substring(path.sep.length + 2) //Cut ../

                    let newLine = line.slice(0, pathBegIdx + 1) + newIncPath + line.slice(PathEndIdx)
                    buffer += newLine + "\n"
                } else {
                    buffer += line + "\n"
                }

            } else {
                buffer += line + "\n"
            }
        })
        fileRd.once('close', () => {
            console.log("FILE READ!")
            fs.writeFileSync(srcFile, buffer)
            console.log("DONE!")
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

    private relativeMovePath(from: string, to: string) {
        let diff = path.relative(from, to)
        if (diff.startsWith(".."))
            return diff.substring(3)
        else
            return diff
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