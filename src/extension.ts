'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { CamelKNodeProvider, TreeNode } from './CamelKIntegrationsNodeProvider';

let outputChannel: vscode.OutputChannel;
let camelKIntegrationsProvider = new CamelKNodeProvider();

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-camelk" is now active!');

	outputChannel = vscode.window.createOutputChannel("Camel-K");

	vscode.window.registerTreeDataProvider('integrations', camelKIntegrationsProvider);
	vscode.commands.registerCommand('integrations.refresh', () => camelKIntegrationsProvider.refresh());
	vscode.commands.registerCommand('integrations.remove', (node: TreeNode) => {
		if (node) {
			let commandString = 'kamel delete "' + node.label + '"';
			console.log('Command string: ' + commandString);
			child_process.exec(commandString, (error, stdout, stderr) => {
				if (error) {
					console.error(`exec error: ${error}`);
					return;
				}
				console.log(`stdout: ${stdout}`);
				console.log(`stderr: ${stderr}`);
			});
			vscode.commands.executeCommand('integrations.refresh');
		}
	});

	let run = vscode.commands.registerCommand('camelk.runfile', () => {
		callKamelViaUIAsync(context);
		vscode.commands.executeCommand('integrations.refresh');
	});
	let stop = vscode.commands.registerCommand('camelk.stopfile', () => {
		performStop(context);
		vscode.commands.executeCommand('integrations.refresh');
	});

	context.subscriptions.push(run, stop);
}

function callKamelViaUIAsync(context: vscode.ExtensionContext): Promise<string> {
	console.log('Calling Kamel');
	return new Promise <string> ( async (resolve, reject) => {
			callKamel(context)
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

function performStop(context: vscode.ExtensionContext): Promise<void> {
	return new Promise( async (resolve, reject) => {
		const editor = vscode.window.activeTextEditor;
		if (typeof(editor) === 'undefined') {
			reject();
			console.error('No active editor present?');
			return;
		}

		const selection = editor.document.fileName;
		const filename = path.normalize(selection);

		const process = context.workspaceState.get(filename) as child_process.ChildProcess;
		if (typeof(process) === 'undefined' || process === null) {
			let commandString = 'kamel delete "' + filename + '"';
			console.log('Command string: ' + commandString);
			child_process.exec(commandString, (error, stdout, stderr) => {
				if (error) {
					console.error(`exec error: ${error}`);
					return;
				}
				console.log(`stdout: ${stdout}`);
				console.log(`stderr: ${stderr}`);

				resolve();
			});
		} else if (process) {
			process.kill('SIGINT');
			context.workspaceState.update(filename, null);
			resolve();
		}
	});
}

function callKamel(context: vscode.ExtensionContext): Promise<boolean> {
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
				context.workspaceState.update(filename, runKamel);
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