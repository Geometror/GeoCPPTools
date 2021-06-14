import * as vscode from 'vscode'
import { ExtensionModule } from './ExtensionModule'

var cfg: vscode.WorkspaceConfiguration

export class QuickIncluder extends ExtensionModule{

    //Keep cached configuration up to date
    public updateConfig() {
        console.log("Config changed.")
        cfg = vscode.workspace.getConfiguration("geocpptools")
    }

    public constructor(context: vscode.ExtensionContext) {
        super(context)
        cfg = vscode.workspace.getConfiguration("geocpptools")
        vscode.workspace.onDidChangeConfiguration(this.updateConfig, undefined)

        let addQuickIncludeCommand = vscode.commands.registerCommand('geocpptools.addQuickInclude', async () => {

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
