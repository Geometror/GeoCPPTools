
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { stdout } from 'process'

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

                    let rootPath = vscode.workspace.rootPath || ""
                    let sourcePath = path.join(rootPath, this.wsConfig.get<string>("includeHelper.sourceFolder", "src"))

                    //TODO: Ermitteln der oberen gemeinsamen Ebene(in spezieller Methode)
                    //-> Relative Pfade daran ausrichten

                    let commonPath = this.findCommonPath(file.oldUri.fsPath, file.newUri.fsPath)

                    let oldPathRel = path.relative(commonPath, file.oldUri.fsPath)
                    let newPathRel = path.relative(commonPath, file.newUri.fsPath)

                    //Möglich: let movePathRel = this.relativeMovePath(oldPathRel, newPathRel)
                    let movePathRel = this.relativeMovePath(file.oldUri.fsPath, file.newUri.fsPath)
                    //vscode.window.showInformationMessage("COMMON:" + commonPath)

                    //Check if file has just been renamed
                    if (!movePathRel.startsWith(path.sep) && !movePathRel.startsWith('.')) {
                        //Eigentlich nicht nötig, da nur eine Datei gleichzeitig umbenannt werden kann
                    }

                    // let diffR = path.relative(newPathRel, oldPathRel)

                    vscode.window.showInformationMessage(oldPathRel + " --> " + newPathRel)
                    vscode.window.showInformationMessage("Difference: " + movePathRel)

                    //TODO: 1. Neue #include<>-Pfade für verschobene Dateien ermitteln
                    //-> Beim Verschieben müssen die #include<>-Pfade der vershobenen Dateien, die sich gegenseitig einbinden nicht angepasst werden
                    //-> Beim Umbennen jedoch schon

                    //TODO: 2. Neue #include<>-Pfade für alle anderen, unveränderten Header/Quellcodedatein ermitteln

                    walkDir(sourcePath, (file: string) => {
                        //Check wether current file was just moved
                        // for(let movedFile of e.files){
                        //     if(movedFile.newUri.fsPath === file)

                        //         return
                        // }
                        const fileContent = fs.readFileSync(file)
                        if (watcherExtensions.includes(path.extname(file).slice(1))) {
                            console.log("FOUND CPP FILES")
                            this.replaceIncludePaths(file)


                        }
                    })

                })
            }

        })

    }

    private async replaceIncludePaths(file: string) {
        const { once } = require('events');
        // console.log(file)
        // fs.readFile(file, 'utf8', (err, data) => {console.log(err)
        //     if (err) vscode.window.showErrorMessage("Could not open file: " + file)

        //     let match
        //     while ((match = this.includeRegex.exec(data)) != null) {
        //         vscode.window.showInformationMessage("Found include! idx=" + match.index + "in file " + file)
        //     }

        // })

        const fileRd = readline.createInterface({
            input: fs.createReadStream(file)
        });

        //Read file line by line and load it into a buffer string
        let buffer = ""
        fileRd.on('line', (line: string) => {
            let includeRegex = new RegExp('#(| +)include(| +)"')

            //Only one match per line allowed/reasonable
            let result = includeRegex.exec(line)
            //console.log(line + "|||||" + result)
            if (result != null) {
                //Replace path 
                console.log("Found include! idx=" + result.index + "in file " + file)
                let pathBegIdx = line.indexOf('"')
                console.log(pathBegIdx)
                

                buffer += "_W_" + line + "\n"
            } else {
                buffer += line + "\n"
            }
        })
        await once(fileRd, 'close');
        console.log("FILE READ!")
        fs.writeFile(file, buffer,
            function () {
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