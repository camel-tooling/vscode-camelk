'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';

let outputChannel: vscode.OutputChannel;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-camelk" is now active!');

	outputChannel = vscode.window.createOutputChannel("Camel-K");

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('camelk.runfile', () => callKamelViaUIAsync());

	context.subscriptions.push(disposable);
}

function callKamelViaUIAsync(): Promise<string> {
	console.log('Calling Kamel');
	return new Promise <string> ( async (resolve, reject) => {
			callKamel()
				.then( success => {
					if (!success) {
						vscode.window.showErrorMessage("Unable to call Kamel.");
						reject();
					}
					resolve();
					return success;
				})
				.catch(err => {
					console.error("Kamel execution return code: " + err);
					reject();
					return err;
				});
		})
		.catch(err => {
			console.error("Error retrieving the required user inputs. " + err);
			return err;
		});
}

function callKamel(): Promise<boolean> {
	console.log('Really calling Kamel');
	return new Promise( (resolve, reject) => {
		try {

			// Get the active text editor
			let editor = vscode.window.activeTextEditor;

			if (editor) {
				let selection = editor.document.fileName;
				let filename = path.normalize(selection);
				let commandString = 'kamel run --dev "' + filename + '"';
				console.log('Command string: ' + commandString);
				let runKamel = child_process.exec(commandString);
				runKamel.stdout.on('data', function (data) {
					console.log("[OUT] " + data);
					outputChannel.append(`${data} \n`);
				});
				runKamel.stderr.on('data', function (data) {
					console.log("[ERROR] " + data);
					outputChannel.append(`${data} \n`);
				});
				runKamel.on("close", (code, signal) => {
					console.log("[CLOSING] " + code);
					if (code === 0) {
						vscode.window.showInformationMessage('Camel-K route running ' + filename);
					} else {
						vscode.window.showErrorMessage('Camel-K route may not have run successfully - please check the output channel for details');
					}
					outputChannel.append("\nProcess finished. Return code " + code + ".\n\n");
					resolve(code === 0);
				});
			}
		} catch (error) {
			console.error(error);
			reject(error);
		}
	});			
}

// this method is called when your extension is deactivated
export function deactivate() {
}