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

	let runGroovy = vscode.commands.registerCommand('camelk.rungroovyfile', () => { runTheFile(context);});
	let stopGroovy = vscode.commands.registerCommand('camelk.stopgroovyfile', () => { stopTheFile(context);});
	let runXml = vscode.commands.registerCommand('camelk.runxmlfile', () => { runTheFile(context);});
	let stopXml = vscode.commands.registerCommand('camelk.stopxmlfile', () => { stopTheFile(context);});
	let runJava = vscode.commands.registerCommand('camelk.runjavafile', () => { runTheFile(context);});
	let stopJava = vscode.commands.registerCommand('camelk.stopjavafile', () => { stopTheFile(context);});

	context.subscriptions.push(runGroovy, stopGroovy, runXml, stopXml, runJava, stopJava);
}

function runTheFile(context: vscode.ExtensionContext) {
	callKamelViaUIAsync(context);
	vscode.commands.executeCommand('integrations.refresh');
}

function stopTheFile(context: vscode.ExtensionContext) {
	performStop(context);
	vscode.commands.executeCommand('integrations.refresh');
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

		let selection = editor.document.fileName;
		let filename = path.normalize(selection);

		// if there's a file extension, get rid of it since it's 
		// ignored when the file is deployed to Camel-K
		if (filename.split('.').length > 0) {
			filename = filename.split('.').slice(0, -1).join('.');
		}

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