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

import { exec, spawn} from "child_process";
import * as child_process from "child_process";
import * as config from './config';
import * as utils from './CamelKJSONUtils';
import * as extension from './extension';
import * as path from 'path';
import * as fs from 'fs';
import * as shell from './shell';

export interface Kamel {
	devMode : boolean;
	namespace: string | undefined;
	getPath() : Promise<string>;
	invoke(command: string): Promise<string>;
	invokeArgs(args: string[], folderName?: string): Promise<child_process.ChildProcess>;
	setDevMode(flag: boolean): void;
	setNamespace(value: string): void;
}

class KamelImpl implements Kamel {
	devMode : boolean = false;
	namespace: string | undefined = config.getNamespaceconfig();
	constructor() {
	}
	async getPath(): Promise<string> {
		const bin = await baseKamelPath();
		return bin;
	}
	async invoke(command: string): Promise<string> {
		return kamelInternal(command, this.devMode, this.namespace);
	}
	invokeArgs(args: string[], folderName?: string): Promise<child_process.ChildProcess> {
		return kamelInternalArgs(args, this.devMode, this.namespace, folderName);
	}
	setDevMode(flag: boolean): void {
		this.devMode = flag;
	}
	setNamespace(value: string): void {
		this.namespace = value;
	}
}

export function create() : Kamel {
	return new KamelImpl();
}

export function getBaseCmd(binpath: string, command: string, namespace : string | undefined) : string {
	let cmd = `${binpath} ${command}`;
	if (namespace) {
		 cmd += ` --namespace=${namespace}`;
	}
	return cmd;
}

async function kamelInternal(command: string, devMode: boolean, namespace : string | undefined): Promise<string> {
	return new Promise( async (resolve, reject) => {
		const bin = await baseKamelPath();
		const binpath = bin.trim();
		if (!fs.existsSync(binpath)) {
			reject(new Error(`Apache Camel K CLI (kamel) unavailable`));
			return;
		}
		const cmd = getBaseCmd(binpath, command, namespace);
		const sr = exec(cmd);
		if (sr) {
			if (sr.stdout) {
				sr.stdout.on('data', function (data) {
					if (devMode && devMode === true) {
						utils.shareMessage(extension.mainOutputChannel, `Dev Mode -- ${data}`);
					}
					resolve(data);
				});
				return;
			}        
			if (sr.stderr) {
				sr.stderr.on('data', function (data) {
					utils.shareMessage(extension.mainOutputChannel, `KA1 Error ${data}`);
					reject(new Error(data));
				});
				return;
			}				
		}
	});
}

async function kamelInternalArgs(args: string[], devMode: boolean, namespace: string | undefined, foldername?: string): Promise<child_process.ChildProcess> {
	return new Promise( async (resolve, reject) => {
		const bin : string = await baseKamelPath();
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
						if (devMode && devMode === true) {
							utils.shareMessage(extension.mainOutputChannel, `Dev Mode -- ${data}`);
						}
					});
				}        
				if (sr.stderr) {
					sr.stderr.on('data', function (data) {
						utils.shareMessage(extension.mainOutputChannel, `KA2 Error ${data}`);
					});
				}
				resolve(sr);
				return sr;
			}
			reject(new Error('Problem retrieving Camel K CLI'));
			return;
		}
	});
}

export async function baseKamelPath(): Promise<string> {
	let result : FindBinaryResult = await findBinary('kamel');
	if (result && result.output && result.err === null) {
		return result.output;
	}
	let bin = config.getActiveKamelconfig();
	if (!bin) {
		bin = 'kamel';
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
