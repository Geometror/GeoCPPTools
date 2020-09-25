
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

    //When files are renamed and MOVED
    public onDidRename(movedFileEvt: vscode.FileRenameEvent): void {
        this.adjustIncludeDirectivePaths(movedFileEvt.files, this.wsConfig.get<boolean>("includeHelper.alwaysShowUserPrompt", true))
    }

    public adjustIncludeDirectivePaths(movedUrisRaw: readonly { oldUri: vscode.Uri, newUri: vscode.Uri }[],
        waitForPrompt: boolean) {

        let movedFileUris: { oldUri: vscode.Uri, newUri: vscode.Uri }[] = new Array()
        for (let movedFile of movedUrisRaw) {

            //Handle directory paths
            if (fs.statSync(movedFile.newUri.fsPath).isDirectory()) {
                let dirNewUri = movedFile.newUri.fsPath

                //Recursively add all files to list
                walkDirSync(dirNewUri, (newPath: string) => {
                    let filePathRel = path.relative(movedFile.newUri.fsPath, newPath)

                    let oldFilePath = "file:///" + movedFile.oldUri.fsPath + path.sep + filePathRel
                    let newFilePath = "file:///" + newPath
                    let oldFileUri = vscode.Uri.parse(oldFilePath)
                    let newFileUri = vscode.Uri.parse(newFilePath)

                    movedFileUris.push({ oldUri: oldFileUri, newUri: newFileUri })
                })

            } else {
                //Source file, add to list
                movedFileUris.push(movedFile)
            }
        }

        //Check wether renamed or moved files are C++ files
        const watcherExtensions = this.wsConfig.get<string[]>("includeHelper.watcherExtensions",
            ["cpp", "hpp", "c", "h", "cc", "cxx", "c++", "C"])

        let cppFilesFound = false
        movedFileUris.forEach((file) => {
            if (watcherExtensions.includes(path.extname(file.oldUri.fsPath).slice(1)))//Remove dot 
                cppFilesFound = true
        })
        if (!cppFilesFound)
            return

        //Check wether confirmation by the user is necessary (property: alwaysShowUserPrompt)
        if (waitForPrompt) {
            let choice = vscode.window.showInformationMessage("C/C++ header/source files have been renamed/moved. \n" +
                "Should the paths of the include directives be adjusted?", "Yes", "No")
            choice.then((str) => {
                if (str === "Yes") {
                    this.walkThroughFiles(movedFileUris, watcherExtensions)
                }
            })
        } else {
            this.walkThroughFiles(movedFileUris, watcherExtensions)
        }

    }


    private walkThroughFiles(movedFiles: readonly { oldUri: vscode.Uri, newUri: vscode.Uri }[], watcherExtensions: string[]) {

        let rootPath = vscode.workspace.rootPath || ""
        let sourcePath = path.join(rootPath, this.wsConfig.get<string>("includeHelper.sourceFolder", "src"))
        let useForwardSlashes = this.wsConfig.get<boolean>("includeHelper.alwaysUseForwardSlash", false)
        const startTime = process.hrtime()

        movedFiles.forEach((movedFile) => {

            //Adjust the include directive paths for all other C++ files in the source folder
            walkDirSync(sourcePath, (srcFile: string) => {

                if (watcherExtensions.includes(path.extname(srcFile).slice(1))) {
                    this.replaceIncludePaths(srcFile,
                        movedFile.oldUri.fsPath,
                        movedFile.newUri.fsPath,
                        movedFiles,
                        useForwardSlashes)
                }
            })
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
                let pointsTo = path.normalize(srcFileDirPath + incPath)
                let movedPointsTo = path.normalize(oldDir + incPath)


                //Update path only when include path points to old location of moved file
                if (movedFileOldUri === pointsTo) {
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

                        //Fix for specific cases where the selected files are distributes over several directory levels
                        //TODO: Reduce/Simplify
                        if (!(!doesOldPointToFile && !doesNewPointToFile && doesMovedPointToFile && !doesNewMovedPointToFile)
                            && (doesMovedPointToFile || doesNewPointToFile)) {
                            buffer += line + "\n"
                            continue
                        }

                    }

                    let newIncPath = path.relative(srcFileDirPath, movedPointsTo)
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

}

function walkDirSync(dir: string, callback: CallableFunction) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ?
            walkDirSync(dirPath, callback) : callback(path.join(dir, f));
    });
};