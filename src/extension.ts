
import * as vscode from 'vscode';
import {IncludeResolver} from "./IncludeResolver"
import {ClassCreator} from "./ClassCreator"
import {FunctionHelper} from "./FunctionHelper"

export function activate(context: vscode.ExtensionContext) {

	console.log('Starting GeoCPPTools')

	//Loading configuration
	let config = vscode.workspace.getConfiguration("geocpptools")
	
	let incResolver = new IncludeResolver();
	let classCreator = new ClassCreator(context);
	let functionHelper = new FunctionHelper(context,config)
	
}


// this method is called when your extension is deactivated
export function deactivate() { }
