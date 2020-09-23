
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { WSASERVICE_NOT_FOUND } from 'constants'

//TODO: Cleanup(path.normalize, pack code in methods)
export class IncludeResolver {

    private wsConfig: vscode.WorkspaceConfiguration

    public constructor(wsConfig: vscode.WorkspaceConfiguration) {

        this.wsConfig = wsConfig

        vscode.workspace.onDidRenameFiles(this.onDidRename, this)
    }

    public adjustIncludePaths(movedFiles: readonly { oldUri: vscode.Uri, newUri: vscode.Uri }[], waitForPrompt: boolean) {
        //TODO: Check wether a directory was moved
        //path.basename or path.endwith(path.sep)
        if (fs.statSync(movedFiles[0].newUri.fsPath).isDirectory()) {
            //Passend? Evtl. rekursiver Durchlauf ausgehend von tiefstem Ordner
            console.log("DIRECTORY!")
            walkDir(movedFiles[0].newUri.fsPath, (srcFile: string) => {
                console.log(srcFile)

            })
        }
        console.log("ENDSWITH:" + movedFiles[0].newUri.fsPath)

        //Check wether renamed or moved files are C++ files
        const watcherExtensions = this.wsConfig.get<string[]>("includeHelper.watcherExtensions",
            ["cpp", "hpp", "c", "h", "cc", "cxx", "c++", "C"])
        let cppFilesFound = false

        movedFiles.forEach((file) => {
            if (watcherExtensions.includes(path.extname(file.oldUri.fsPath).slice(1)))//Remove dot 
                cppFilesFound = true
        })

        //If no source files are moved, abort
        if (!cppFilesFound)
            return

        //Check wether confirmation by the user is necessary
        if (waitForPrompt) {
            let choice = vscode.window.showInformationMessage("C/C++ header/source files have been renamed/moved. \n" +
                "Should the paths of the include directives be adjusted?", "Yes", "No")
            choice.then((str) => {
                if (str === "Yes") {
                    this.prepare(movedFiles,watcherExtensions)
                }
            })
        } else {
            this.prepare(movedFiles, watcherExtensions)
        }

    }

    private prepare(movedFiles: readonly { oldUri: vscode.Uri, newUri: vscode.Uri }[], watcherExtensions: string[]) {

        let rootPath = vscode.workspace.rootPath || ""
        let sourcePath = path.join(rootPath, this.wsConfig.get<string>("includeHelper.sourceFolder", "src"))
        let useForwardSlashes = this.wsConfig.get<boolean>("includeHelper.alwaysUseForwardSlash", false)
        const startTime = process.hrtime()

        movedFiles.forEach((movedFile) => {

            //Adjust the include directive paths for all other C++ files in the source folder
            walkDir(sourcePath, (srcFile: string) => {

                if (watcherExtensions.includes(path.extname(srcFile).slice(1))) {
                    this.replaceIncludePaths(srcFile,
                        movedFile.oldUri.fsPath,
                        movedFile.newUri.fsPath,
                        movedFiles,
                        useForwardSlashes)
                }
            })
            console.log("DONE processing moved file:" + movedFile.newUri)
        })
        const timePassed = process.hrtime(startTime)
        vscode.window.showInformationMessage("Paths of Include directives adjusted.(Took " + timePassed + "s)")

    }

    private replaceIncludePaths(srcFile: string,
        movedFileOldUri: string,
        movedFileNewUri: string,
        allMovedFiles: ReadonlyArray<{ oldUri: vscode.Uri, newUri: vscode.Uri }>,
        useForwardSlashes: boolean) {

        let buffer = ""
        let lines = fs.readFileSync(srcFile, 'utf-8')
            .split('\n')

        for (const line of lines) {
            //Search each line for an include directive
            let includeRegex = new RegExp('#(| +)include(| +)"')
            let result = includeRegex.exec(line)

            if (result != null) {
                //Parse include directive
                let pathBegIdx = line.indexOf('"')
                let PathEndIdx = line.indexOf('"', pathBegIdx + 1)
                let incPath = line.substring(pathBegIdx + 1, PathEndIdx)
                let srcFileDirPath = path.dirname(srcFile) + path.sep
                let oldDir = path.dirname(movedFileOldUri) + path.sep
                let pointsToFile = path.normalize(srcFileDirPath + incPath)
                let movedPointsToFile = path.normalize(oldDir + incPath)

                //Update path only when include path points to old location of moved file
                if (movedFileOldUri === pointsToFile) {
                    let newIncPath = path.relative(srcFileDirPath, movedFileNewUri)
                    if (useForwardSlashes)
                        newIncPath.replace('\\', '/')

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
                            if (fa.oldUri.fsPath === movedPointsToFile) includes = true
                        }
                        if (includes) {
                            buffer += line + "\n"
                            continue
                        }
                    }
                    //TODO: Fix changing path in a weird way
                    let newIncPath = path.relative(srcFileDirPath, movedPointsToFile)
                    if (useForwardSlashes)
                        newIncPath.replace('\\', '/')

                    let newLine = line.slice(0, pathBegIdx + 1) + newIncPath + line.slice(PathEndIdx)
                    buffer += newLine + "\n"
                } else {
                    buffer += line + "\n"
                }

            } else {
                buffer += line + "\n"
            }
        }

        //Save modified file 
        fs.writeFileSync(srcFile, buffer)

    }

    //When files are renamed and MOVED
    public onDidRename(movedFileEvt: vscode.FileRenameEvent): void {
        this.adjustIncludePaths(movedFileEvt.files, this.wsConfig.get<boolean>("includeHelper.alwaysShowUserPrompt",true))
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