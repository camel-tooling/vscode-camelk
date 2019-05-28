/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import { CamelKNodeProvider, TreeNode } from './CamelKNodeProvider';

let outputChannel: vscode.OutputChannel;
let camelKIntegrationsProvider = new CamelKNodeProvider();

export function activate(context: vscode.ExtensionContext) {

	outputChannel = vscode.window.createOutputChannel("Camel-K");

	// create the integrations view
	vscode.window.registerTreeDataProvider('camelk.integrations', camelKIntegrationsProvider);

	// create the two integration view actions -- refresh and remove
	vscode.commands.registerCommand('camelk.integrations.refresh', () => camelKIntegrationsProvider.refresh());
	vscode.commands.registerCommand('camelk.integrations.remove', (node: TreeNode) => {
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
			camelKIntegrationsProvider.refresh();
		}
	});

	// create all the commands to run the various types of files supported by Camel-K
	let startIntegration = vscode.commands.registerCommand('camelk.startintegration', () => { runTheFile(context);});
	let stopIntegration = vscode.commands.registerCommand('camelk.stopintegration', () => { stopTheFile(context);});

	context.subscriptions.push(startIntegration, stopIntegration);
}

// "run" the integration file with "kamel"
function runTheFile(context: vscode.ExtensionContext) {
	startIntegration(context);
	camelKIntegrationsProvider.refresh();
}

// "stop" a running integration in the camel-k system
function stopTheFile(context: vscode.ExtensionContext) {
	stopIntegration(context);
	camelKIntegrationsProvider.refresh();
}

// call the kamel utility to start an integration from a file
function startIntegration(context: vscode.ExtensionContext): Promise<string> {
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

// stop a running integration using the command-line "kamel" utility
// TODO: research using the rest API for camel-k  
function stopIntegration(context: vscode.ExtensionContext): Promise<void> {
	return new Promise( async (resolve, reject) => {
		const editor = vscode.window.activeTextEditor;
		if (typeof(editor) === 'undefined') {
			reject();
			console.error('No active editor present?');
			return;
		}

		let selection = editor.document.fileName;
		let filename = path.basename(selection);
		let root = path.dirname(selection);
		let absoluteRoot = path.resolve(root);

		// if there's a file extension, get rid of it since it's 
		// ignored when the file is deployed to Camel-K
		if (filename.split('.').length > 0) {
			filename = filename.split('.').slice(0, -1).join('.');
		}

		// TODO: Make sure that we mangle the name the same way kamel does
		// so we can get the name of the integration created when it is deployed.
		// Otherwise we can't shut it down properly from this direction and have
		// to use the "remove" method from the Integrations view.

		let commandString = 'kamel delete "' + filename + '"';
		console.log('Command string: ' + commandString);
		child_process.exec(commandString, { cwd : absoluteRoot}, (error, stdout, stderr) => {
			if (error) {
				console.error(`exec error: ${error}`);
				return;
			}
			console.log(`stdout: ${stdout}`);
			console.log(`stderr: ${stderr}`);
			resolve();
		});
	});
}

// use command-line "kamel" utility to handle various commands
// TODO: research using the rest API for camel-k 
function callKamel(context: vscode.ExtensionContext): Promise<boolean> {
	return new Promise( (resolve, reject) => {
		try {

			const editor = vscode.window.activeTextEditor;
			if (typeof(editor) === 'undefined') {
				reject();
				console.error('No active editor present?');
				return;
			}
	
			let selection = editor.document.fileName;
			let filename = path.basename(selection);
			let root = path.dirname(selection);
			let absoluteRoot = path.resolve(root);

			if (editor) {
				let commandString = 'kamel run --dev "' + filename + '"';
				console.log('Command string: ' + commandString);
				let runKamel = child_process.exec(commandString, { cwd : absoluteRoot});
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