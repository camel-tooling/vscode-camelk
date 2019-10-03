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

export interface Kubectl {
	namespace: string;
	getPath() : Promise<string>;
	invokeArgs(args: string[], folderName?: string): Promise<child_process.ChildProcess>;
	setNamespace(value: string): void;
}

class KubectlImpl implements Kubectl {
	namespace: string = 'default';
	constructor() {
	}
	async getPath(): Promise<string> {
		const bin = await baseKubectlPath();
		return bin;
	}
	invokeArgs(args: string[], folderName?: string): Promise<child_process.ChildProcess> {
		return kubectllInternalArgs(args, folderName);
	}
	setNamespace(value: string): void {
		this.namespace = value;
	}
}

export function create() : Kubectl {
	return new KubectlImpl();
}

async function kubectllInternalArgs(args: string[], foldername?: string): Promise<child_process.ChildProcess> {
	return new Promise( async (resolve, reject) => {
		const bin : string = await baseKubectlPath();
		if (bin) {
			const binpath = bin.trim();
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
						utils.shareMessage(extension.mainOutputChannel, `Error ${data}`);
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
		return result.output.trim();
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
