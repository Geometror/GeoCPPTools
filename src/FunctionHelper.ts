import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { ExtensionModule } from './ExtensionModule'
export class FunctionHelper extends ExtensionModule {

    public constructor(context: vscode.ExtensionContext) {
        super(context)

        let changeMethodSignature = vscode.commands.registerCommand('geocpptools.changeFunctionSignature', async (fileUri) => {
            const editor = vscode.window.activeTextEditor!

            console.log("FORWARDED VALUE:" + editor.document.uri)
            console.log("START CHAR POS:" + editor.selection.start.character)
            console.log("END CHAR POS:" + editor.selection.end.character)
            console.log("CURSOR POS:" + editor.selection.active)
            console.log("CURSOR POS:" + editor.selection)

            let selContent = editor.document.getText(new vscode.Range(editor.selection.start, editor.selection.end))
            console.log("CONTENT" + selContent)

            let content = editor.document.getText()

            if (editor.selection.isEmpty) {
                //TODO: Determine method signature
                let options = {
                    value: "djsfljdlsfj",
                    prompt: "Change method signature:"
                }
                vscode.window.showInputBox(options)
            }
        })
        context.subscriptions.push(changeMethodSignature)
    }

}