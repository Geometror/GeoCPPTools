
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

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

        // if (fs.statSync(movedFiles[0].newUri.fsPath).isDirectory()) {
        //     //Passend? Evtl. rekursiver Durchlauf ausgehend von tiefstem Ordner
        //     console.log("DIRECTORY!")
        //     walkDir(movedFiles[0].newUri.fsPath, (srcFile: string) => {
        //         console.log(srcFile)

        //     })
        // }

        console.log("FIRST PATH:" + movedFiles[0].newUri.fsPath)

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
                    this.prepare(movedFiles, watcherExtensions)
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
            console.log("##################################################################")
            console.log("Processing moved file:" + movedFile.newUri)

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
                console.log("------>\nFound include [SRC FILE: " + srcFile + "]")
                //Parse include directive
                let pathBegIdx = line.indexOf('"')
                let PathEndIdx = line.indexOf('"', pathBegIdx + 1)
                let incPath = line.substring(pathBegIdx + 1, PathEndIdx)
                let srcFileDirPath = path.dirname(srcFile) + path.sep
                let oldDir = path.dirname(movedFileOldUri) + path.sep
                let pointsTo = path.normalize(srcFileDirPath + incPath)
                let movedPointsTo = path.normalize(oldDir + incPath)

                console.log("INC PATH:" + incPath)
                console.log("POINTS TO      :" + pointsTo)
                console.log("MOVED POINTS TO:" + movedPointsTo)
                console.log("OLDURI (NORM)  :" + path.normalize(movedFileOldUri))
                console.log("NEWURI (NORM)  :" + path.normalize(movedFileNewUri))

                //Update path only when include path points to old location of moved file
                if (movedFileOldUri === pointsTo) {
                    let newIncPath = path.relative(srcFileDirPath, movedFileNewUri)
                    if (useForwardSlashes)
                        newIncPath.replace('\\', '/')

                    console.log("NEW INC PATH:" + newIncPath)
                    let newLine = line.slice(0, pathBegIdx + 1) + newIncPath + line.slice(PathEndIdx)
                    buffer += newLine + "\n"

                } else if (movedFileNewUri === srcFile) {
                    //Handling the include directive of the moved files

                    //When several files are moved
                    if (allMovedFiles.length > 1) {
                        //Check if the file is part of the moved files, but not itself
                        //If file which the include path is pointing to was also moved do nothing
                        let doesOldPointToFile = false
                        let doesNewPointToFile = false
                        let doesMovedPointToFile = false
                        let doesNewMovedPointToFile = false

                        for (let fa of allMovedFiles) {
                            if (fa.oldUri.fsPath === pointsTo)
                                doesOldPointToFile = true
                            if (fa.newUri.fsPath === pointsTo)
                                doesNewPointToFile = true
                            if (fa.oldUri.fsPath === movedPointsTo)
                                doesMovedPointToFile = true
                            if (fa.newUri.fsPath === movedPointsTo)
                                doesNewMovedPointToFile = true
                        }
                        console.log("OLDURI == POINTS_TO:" + doesOldPointToFile)
                        console.log("NEWURI == POINTS_TO:" + doesNewPointToFile)
                        console.log("OLDURI == MOVED_POINTS_TO:" + doesMovedPointToFile)
                        console.log("NEWURI == MOVED_POINTS_TO:" + doesNewMovedPointToFile)

                        //When files of different folders are selected, this condition is
                        //TODO: Vereinfachen
                        if (!(!doesOldPointToFile && !doesNewPointToFile && doesMovedPointToFile && !doesNewMovedPointToFile)) {
                            if (doesMovedPointToFile || doesNewPointToFile) {
                                buffer += line + "\n"
                                continue
                            }
                        }

                    }
                    //TODO: Fix changing path in a weird way
                    let newIncPath = path.relative(srcFileDirPath, movedPointsTo)
                    if (useForwardSlashes)
                        newIncPath.replace('\\', '/')
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

        //Save modified file 
        fs.writeFileSync(srcFile, buffer)

    }

    //When files are renamed and MOVED
    public onDidRename(movedFileEvt: vscode.FileRenameEvent): void {
        this.adjustIncludePaths(movedFileEvt.files, this.wsConfig.get<boolean>("includeHelper.alwaysShowUserPrompt", true))
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