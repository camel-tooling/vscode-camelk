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

import { spawn} from "child_process";
import * as child_process from "child_process";
import * as config from './config';
import * as shell from './shell';
import * as utils from './CamelKJSONUtils';
import * as extension from './extension';
import * as path from 'path';
import { ChildProcess } from "child_process";
import * as shelljs from 'shelljs';

export interface Kubectl {
	namespace: string | undefined;
	getPath() : Promise<string>;
	invokeArgs(args: string[], folderName?: string): Promise<child_process.ChildProcess>;
	setNamespace(value: string): void;
	invokeAsync(command: string, stdin?: string, callback?: (proc: ChildProcess) => void): Promise<ShellResult | undefined>;
}

class KubectlImpl implements Kubectl {
	namespace: string | undefined = config.getNamespaceconfig();
	constructor() {
	}
	async getPath(): Promise<string> {
		const bin = await baseKubectlPath();
		return bin;
	}
	invokeArgs(args: string[], folderName?: string): Promise<child_process.ChildProcess> {
		return kubectllInternalArgs(args, this.namespace, folderName);
	}
	setNamespace(value: string): void {
		this.namespace = value;
	}

	async invokeAsync(command: string, stdin?: string, callback?: (proc: ChildProcess) => void): Promise<ShellResult | undefined> {
		return internalInvokeAsync(command, stdin, callback);
	}
	
}

export interface ShellResult {
	readonly code: number;
	readonly stdout: string;
	readonly stderr: string;
}

// code added to handle streaming of log content to the logsWebView/webpanel 
async function internalInvokeAsync(command: string, stdin?: string, callback?: (proc: ChildProcess) => void): Promise<ShellResult | undefined> {
	const bin = await baseKubectlPath();
	if (bin) {
		const binpath = bin.trim();
		const cmd = `${binpath} ${command}`;
		let sr: ShellResult | undefined;
		if (stdin) {
			sr = await exec(cmd, stdin);
		} else if (callback) {
			sr = await execStreaming(cmd, callback);
		}
		return sr;
	}
}

async function execStreaming(cmd: string, callback: (proc: ChildProcess) => void): Promise<ShellResult | undefined> {
	try {
		return await execCore(cmd, null, callback);
	} catch (ex) {
		utils.shareMessage(extension.mainOutputChannel, `${ex}`);
		return undefined;
	}
}

async function exec(cmd: string, stdin?: string): Promise<ShellResult | undefined> {
	try {
		return await execCore(cmd, null, null, stdin);
	} catch (ex) {
		utils.shareMessage(extension.mainOutputChannel, `${ex}`);
		return undefined;
	}
}

function execCore(cmd: string, opts: any, callback?: ((proc: ChildProcess) => void) | null, stdin?: string): Promise<ShellResult> {
	return new Promise<ShellResult>((resolve) => {
		const proc = shelljs.exec(cmd, opts, (code, stdout, stderr) => resolve({code : code, stdout : stdout, stderr : stderr}));
		if (stdin && proc.stdin) {
			proc.stdin.end(stdin);
		}
		if (callback) {
			callback(proc);
		}
	});
}

export function create() : Kubectl {
	return new KubectlImpl();
}

async function kubectllInternalArgs(args: string[], namespace: string | undefined, foldername?: string): Promise<child_process.ChildProcess> {
	return new Promise( async (resolve, reject) => {
		const bin : string = await baseKubectlPath();
		if (bin) {
			const binpath = bin.trim();
			if (namespace) {
				args.push(`--namespace=${namespace}`);
			}
			let sr : child_process.ChildProcess;
			if (foldername) {
				sr = spawn(binpath, args, { cwd : foldername});
			} else {
				sr = spawn(binpath, args);
			}
			if (sr) {
				if (sr.stdout) {
					sr.stdout.on('data', function (data) {
						resolve(data);
					});
				}        
				if (sr.stderr) {
					sr.stderr.on('data', function (data) {
						utils.shareMessage(extension.mainOutputChannel, `${data}`);
						reject(new Error(data));
					});
				}
				
				resolve(sr);
				return sr;
			}
			reject(new Error('Problem retrieving Kubernetes CLI'));
			return;
		}
	});
}

export async function baseKubectlPath(): Promise<string> {
	let result : FindBinaryResult = await findBinary('kubectl');
	if (result && result.output && result.err === null) {
		return result.output;
	}
	let bin = config.getActiveKubectlconfig();
	if (!bin) {
		bin = 'kubectl';
		return bin;
	}
	let binpath = path.normalize(bin);
	return binpath;
}

interface FindBinaryResult {
	err: number | null;
	output: string;
}

async function findBinary(binName: string): Promise<FindBinaryResult> {
	let cmd = `which ${binName}`;

	if (shell.isWindows()) {
		cmd = `where.exe ${binName}.exe`;
	}

	const opts = {
		async: true,
		env: {
			HOME: process.env.HOME,
			PATH: process.env.PATH
		}
	};

	const execResult = await shell.execCore(cmd, opts);
	if (execResult.code) {
		return { err: execResult.code, output: execResult.stderr };
	}

	return { err: null, output: execResult.stdout };
}
