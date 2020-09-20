
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {IncludeResolver} from "./IncludeResolver"
import {ClassCreator} from "./ClassCreator"

export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Starting GeoCPPTools')
	console.log("GeoCPPTools/Root path: "+vscode.workspace.rootPath)
	
	//Loading configuration
	let config = vscode.workspace.getConfiguration("geocpptools")

	let incResolver = new IncludeResolver(config);
	let classCreator = new ClassCreator(context);
	
}


// this method is called when your extension is deactivated
export function deactivate() { }
