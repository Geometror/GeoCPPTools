import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { ExtensionModule } from "./ExtensionModule"
import * as vr from "./VarResolver"
export class ClassCreator extends ExtensionModule {

    public constructor(context: vscode.ExtensionContext) {
        super(context)

        let createCPPClass = vscode.commands.registerCommand('geocpptools.createCPPClass', async (fileUri) => {

            console.log(fileUri)

            //TODO: Check wether a folder is open

            let projectDir = vscode.workspace.workspaceFolders![0].uri.fsPath || ""
            if (projectDir == undefined || fileUri == undefined) {
                vscode.window.showErrorMessage("Failed to create class: No open workspace/folder")
                return
            }

            let targetDir = fileUri.fsPath
            // if (context != undefined) {
            // 	targetDir = context.extensionUri.fsPath
            // } else {
            // 	if (vscode.window.activeTextEditor != undefined) {
            // 		targetDir = vscode.window.activeTextEditor.document.uri.path
            // 	}
            // }

            this.openInput().then((className: string | undefined) => {

                if (className == undefined) {
                    vscode.window.showErrorMessage("Class creation failed: Input undefined!")
                    return
                } else if (className == "") {
                    vscode.window.showErrorMessage("Class creation failed: Input empty!")
                    return
                } else if (className.includes(" ")) {
                    vscode.window.showErrorMessage("Class creation failed: Spaces are not allowed")
                    return
                }

                let mode = this.getConfig().get<string>("classCreator.mode", "default");
                this.createClass(targetDir, className, mode)
            })

        })
        context.subscriptions.push(createCPPClass)
    }

    private openInput(): Thenable<string | undefined> {

        var options: vscode.InputBoxOptions = {
            ignoreFocusOut: false,
            placeHolder: "MyClass",
            prompt: "Enter your class name:"
        }
        return vscode.window.showInputBox(options)
    }

    private createClass(targetDir: string, name: string, mode: string) {

        let headerFileDir = ""
        let srcFileDir = ""
        switch (mode) {
            case "new folder": {
                let newDirPath = path.join(targetDir,name)
                fs.mkdirSync(newDirPath)
                headerFileDir = newDirPath
                srcFileDir = newDirPath
                break;
            }
            case "separate folders": {
                
                let headerPath = this.getConfig().get<string>("classCreator.headerFolder", "${workspaceFolder}/include")
                let sourcePath = this.getConfig().get<string>("classCreator.sourceFolder", "${workspaceFolder}/src")
                
                console.log("HEADER " + headerPath)
                console.log("SOURCE " + sourcePath)

                let customHeaderDir = vr.resolveVariables(headerPath)
                let customSrcDir = vr.resolveVariables(sourcePath)

                if (!fs.existsSync(customHeaderDir)) { fs.mkdirSync(customHeaderDir) }
                if (!fs.existsSync(customSrcDir)) { fs.mkdirSync(customSrcDir) }

                headerFileDir = customHeaderDir
                srcFileDir = customSrcDir
                break;
            }
            case "separate folders (source in selected folder)": {

                let customHeaderDir = vr.resolveVariables(this.getConfig().get<string>("classCreator.headerFolder", "${workspaceFolder}/include"))
                if (!fs.existsSync(customHeaderDir)) { fs.mkdirSync(customHeaderDir) }
                headerFileDir = customHeaderDir
                srcFileDir = targetDir
                break;
            }
            case "default":
            default: {
                headerFileDir = targetDir
                srcFileDir = targetDir
            }
        }

        this.createHeaderFile(headerFileDir, name)
        this.createSourceFile(srcFileDir, name)
        //Open the created header file
        this.openTextDocument(`${headerFileDir}${path.sep}${name}.hpp`)
    }

    private openTextDocument(filename: string) {
        vscode.workspace.openTextDocument(filename).then(doc => {
            vscode.window.showTextDocument(doc)
        })
    }

    private createHeaderFile(dir: string, name: string) {
        //TODO: Set header guard style
        //TODO: Support for custom templates(advanced)
        let headerFileContent = 
            `#pragma once\n` +
            `\n` +
            `class ${name} {\n` +
            `public:\n` +
            `\n` +
            `\n` +
            `};\n`
        this.writeFile(dir, `${name}.hpp`, headerFileContent)
    }

    private createSourceFile(dir: string, name: string) {

        let sourceFileContent =
            `#include "${name}.hpp"\n` +
            `\n` +
            `\n`
        this.writeFile(dir, `${name}.cpp`, sourceFileContent)
    }

    private writeFile(dir: string, name: string, data: string) {
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir)
        let fullFilePath = dir + path.sep + name
        fs.writeFileSync(fullFilePath, data)
    }


}







