import * as vscode from 'vscode'

import * as path from 'path'
import * as cp from 'child_process'
import { Uri, window, Disposable } from 'vscode'
import { QuickPickItem } from 'vscode'
import { workspace } from 'vscode'
import * as fs from 'fs'
import { deprecate } from 'util'

var cfg: vscode.WorkspaceConfiguration

export class QuickIncluder {

    //Keep cached configuration up to date
    public updateConfig() {
        console.log("Config changed.")
        cfg = vscode.workspace.getConfiguration("geocpptools")
    }

    public constructor(context: vscode.ExtensionContext) {

        cfg = vscode.workspace.getConfiguration("geocpptools")
        vscode.workspace.onDidChangeConfiguration(this.updateConfig, undefined)

        let addQuickIncludeCommand = vscode.commands.registerCommand('geocpptools.addQuickInclude', async () => {
            //TODO: Path autocomplete
            //TODO: More adjustable settings(input position)

            //just for testing
            // workspace.workspaceFolders?.forEach(folder => {
            //     let cppConfPath = path.join(folder.uri.fsPath, "/.vscode", "/c_cpp_properties.json").normalize()
            //     console.log("PATH" + cppConfPath)
            //     var file = JSON.parse(fs.readFileSync(cppConfPath, "utf8"))
            //     file ? console.log("file ok") : console.log("file UNDEFINED")

            //     let includePaths = file["configurations"][0]["includePath"]
            //     if (includePaths) {
            //         includePaths.forEach((a: string) => {
            //             console.log(a)
            //         })
            //     }
            // })

            let items: vscode.QuickPickItem[] = [
                { label: '<...>', detail: "anglebrackets" },
                { label: '"..."', detail: "quotes" }
            ]


            //TODO: Unify
            vscode.window.showQuickPick(items).then(selection => {

                let mode = cfg.get<string>("quickIncluder.mode")
                console.log("MODE" + mode)
                if (mode == "jump to top") {
                    let isAngleBrackets = (selection?.detail == "anglebrackets")

                    const editor = vscode.window.activeTextEditor

                    if (editor) {
                        const text = editor.document.getText()
                        const regex = /[ \t]*#\s*(include\s+[<\"][^>\"]*[>\"]|\s*pragma\s*once.*)|[ \t]*#\s*ifndef.*\r\n[ \t]*#\s*define.*/g
                        let match


                        //TODO: Option to insert on top
                        let insertionOffset = 0
                        do {
                            match = regex.exec(text)
                            if (match) {
                                insertionOffset = match.index + match[0].length + 1
                            }
                        } while (match)

                        let insertionStr = '\n#include ' + (isAngleBrackets ? '<>' : '""')

                        editor.edit((editBuilder) => {

                            let cursorPos = editor.document.positionAt(insertionOffset)
                            editor.selection = new vscode.Selection(cursorPos, cursorPos)

                            let insertionPos = editor.document.positionAt(insertionOffset)
                            editBuilder.insert(insertionPos, insertionStr)

                        }).then(() => {
                            let newPos = editor.document.positionAt(insertionOffset - 1 + insertionStr.length)
                            editor.selection = new vscode.Selection(newPos, newPos)
                        })
                    }
                } else {
                    vscode.window.showInputBox({
                        value: '.hpp',
                        valueSelection: [0, 0],
                        validateInput: this.validateInput
                    }).then(value => {
                        if (value) {

                            let isAngleBrackets = (selection?.detail == "anglebrackets")

                            if (isAngleBrackets) {
                                value = `<${value}>`
                            } else {
                                value = `\"${value}\"`
                            }

                            const editor = vscode.window.activeTextEditor
                            let sel = editor?.selection.active
                            if (sel) {
                                let linePos = sel.line + 1
                                let rowPos = sel.character
                                console.log(rowPos)
                                console.log(linePos)
                                editor?.selection
                            }

                            if (editor) {
                                const text = editor.document.getText()

                                const regex = /[ \t]*#\s*(include\s+[<\"][^>\"]*[>\"]|\s*pragma\s*once.*)|[ \t]*#\s*ifndef.*\r\n[ \t]*#\s*define.*/g
                                let match

                                let insertionOffset = 0
                                do {
                                    match = regex.exec(text)
                                    if (match) {
                                        insertionOffset = match.index + match[0].length + 1
                                    }
                                } while (match)
                                let insertionStr = '\n#include ' + value

                                editor.edit((editBuilder) => {
                                    let insertionPos = editor.document.positionAt(insertionOffset)
                                    editBuilder.insert(insertionPos, insertionStr)
                                })
                            }
                        }
                    })
                }

            })

        })

        context.subscriptions.push(addQuickIncludeCommand)
    }

    private validateInput(value: String) {
        if (value.length === 0) {
            return 'Enter a valid include file'
        } else if (value[0] === '\"' && value[value.length - 1] !== '\"') {
            return `\`#include ${value}\` is not a valid include statement.`
        } else if (value[0] === '<' && value[value.length - 1] !== '>') {
            return `\`#include ${value}\` is not a valid include statement.`
        } else {
            return null
        }
    }
}

//Deprecated
// class FileItem implements QuickPickItem {

//     label: string
//     description: string

//     constructor(public base: Uri, public filePath: Uri) {
//         this.label = path.basename(filePath.fsPath)
//         this.description = path.dirname(path.relative(base.fsPath, filePath.fsPath))
//     }
// }

// async function pickFile() {
//     const disposables: Disposable[] = []
//     try {
//         return await new Promise<Uri | undefined>((resolve, reject) => {
//             const input = window.createQuickPick<FileItem>()
//             input.placeholder = 'Type to search for files'
//             let rgs: cp.ChildProcess[] = []
//             disposables.push(
//                 input.onDidChangeValue(value => {
//                     rgs.forEach(rg => rg.kill())
//                     if (!value) {
//                         input.items = []
//                         return
//                     }
//                     input.busy = true
//                     const includeDirs = workspace.workspaceFolders ? workspace.workspaceFolders.map(f => f.uri.fsPath) : [process.cwd()]

//                     includeDirs.forEach(cwd => {
//                         searchFiles(cwd, value, [".hpp", ".h", ".hh", ".h++"], (filestr: string) => {
//                             input.items = input.items.concat([
//                                 new FileItem(Uri.file(cwd), Uri.file(filestr))
//                             ])
//                         })
//                     })
//                 }),
//                 input.onDidChangeSelection(items => {
//                     const item = items[0]
//                     if (item instanceof FileItem) {
//                         resolve(item.filePath)
//                         input.hide()
//                     }
//                 }),
//                 input.onDidHide(() => {
//                     rgs.forEach(rg => rg.kill())
//                     resolve(undefined)
//                     input.dispose()
//                 })
//             )
//             input.show()
//         })
//     } finally {
//         disposables.forEach(d => d.dispose())
//     }
// }

// function searchFiles(dir: string, searchStr: string, fileExts: string[], callback: CallableFunction) {
//     fs.readdirSync(dir).forEach(f => {
//         let dirPath = path.join(dir, f)
//         let isDirectory = fs.statSync(dirPath).isDirectory()
//         if (isDirectory) {
//             searchFiles(dirPath, searchStr, fileExts, callback)
//         } else {
//             if (dirPath.includes(searchStr) && fileExts.includes(path.extname(dirPath))) {
//                 callback(path.join(dir, f))
//             }
//         }
//     })
// }