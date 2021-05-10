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
import * as kamel from '../kamel';
import { TreeNode } from "../CamelKNodeProvider";

export async function start(integrationItem: TreeNode): Promise<void> {
	const kamelExecutor: kamel.Kamel = kamel.create();
	let kamelArgs: string[] = [];
	kamelArgs.push('debug');
	const integrationName = integrationItem.label as string;
	kamelArgs.push(integrationName);
	//TODO: improve by searching for a free port
	const childProcess = await kamelExecutor.invokeArgs(kamelArgs);
	let debuggerLaunched = false;
	childProcess.stdout?.on('data', function (data) {
		const messageData: string = `${data}`;
		if (!debuggerLaunched && messageData.includes('Listening for transport dt_socket at address:')) {
			const workspaceFolderList = vscode.workspace.workspaceFolders;
			if (workspaceFolderList) {
				const debugConfiguration: vscode.DebugConfiguration = {
					name: `Attach Java debugger to Camel K integration ${integrationName}`,
					type: 'java',
					request: 'attach',
					// TODO: how to determine host more precisely?
					hostName: 'localhost',
					port: 5005
				};
				debuggerLaunched = true;
				vscode.debug.startDebugging(workspaceFolderList[0], debugConfiguration);
			}
		}
	});
	//TODO: delete child process when disconnecting? When undeploying? How?
}