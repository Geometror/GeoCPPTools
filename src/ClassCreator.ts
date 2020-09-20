import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class ClassCreator implements vscode.Disposable {

    public constructor(context: vscode.ExtensionContext) {
        let createCPPClass = vscode.commands.registerCommand('geocpptools.createCPPClass', async (fileUri) => {
            // The code you place here will be executed every time your command is executed
            console.log(fileUri)

            //TODO: Check wether a folder is open

            let projectDir = vscode.workspace.rootPath
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

            openInput().then((className: string | undefined) => {

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

                createClass(targetDir, className)
            })

        });
        context.subscriptions.push(createCPPClass)
    }
    
    dispose() {

    }
}


function openInput(): Thenable<string | undefined> {

    var options: vscode.InputBoxOptions = {
        ignoreFocusOut: false,
        placeHolder: "MyClass",
        prompt: "Enter your class name:"
    }
    return vscode.window.showInputBox(options)
}

function createClass(targetDir: string, name: string) {

    //TODO: Add support for different modes
    //Mode 1: Header and Source in same directory
    //Mode 2: Header in include dir/Source in src dir
    //Mode 3: Create dedicated folder for class(header and source)

    let headerFileDir: string = targetDir;
    let srcFileDir: string = targetDir;

    createHeaderFile(headerFileDir, name)
    createSourceFile(srcFileDir, name)
    //Open the created header file
    openTextDocument(`${targetDir}${path.sep}${name}.hpp`)
}

function openTextDocument(filename: string) {
    vscode.workspace.openTextDocument(filename).then(doc => {
        vscode.window.showTextDocument(doc)
    })
}

function createHeaderFile(dir: string, name: string) {
    //TODO: Set header guard style
    //TODO: Support for custom templates(advanced)
    let headerFileData =
        `#pragma once\n` +
        `\n` +
        `class ${name}\n` +
        `{\n` +
        `public:\n` +
        `\n` +
        `\n` +
        `private:\n` +
        `\n` +
        `\n` +
        `};\n` +
        ``
    writeFile(dir, `${name}.hpp`, headerFileData);
}

function createSourceFile(dir: string, name: string) {

    let sourceData =
        `#include "${name}.hpp"\n` +
        `\n` +
        `\n` +
        ``
    writeFile(dir, `${name}.cpp`, sourceData)
}

function writeFile(dir: string, name: string, data: string) {
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir)
    let fullFilePath = dir + path.sep + name
    fs.writeFileSync(fullFilePath, data)
}




