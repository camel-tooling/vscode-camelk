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
import { exec, spawn, ChildProcess} from "child_process";
import * as config from './config';
import * as utils from './CamelKJSONUtils';
import * as extension from './extension';
import * as path from 'path';
import * as fs from 'fs';
import { FindBinaryResult, findBinary } from "./shell";

export interface Kamel {
	devMode : boolean;
	namespace: string | undefined;
	getPath() : Promise<string>;
	invoke(command: string): Promise<string>;
	invokeArgs(args: string[], folderName?: string): Promise<ChildProcess>;
	setDevMode(flag: boolean): void;
	setNamespace(value: string): void;
}

class KamelImpl implements Kamel {
	devMode : boolean = false;
	namespace: string | undefined = config.getNamespaceconfig();

	constructor() {
	}

	async getPath(): Promise<string> {
		return baseKamelPath();
	}

	async invoke(command: string): Promise<string> {
		return kamelInternal(command, this.devMode, this.namespace);
	}

	invokeArgs(args: string[], folderName?: string): Promise<ChildProcess> {
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
	let cmd: string = `"${binpath}" ${command}`;
	if (namespace) {
		 cmd += ` --namespace=${namespace}`;
	}
	return cmd;
}

async function kamelInternal(command: string, devMode: boolean, namespace : string | undefined): Promise<string> {
	return new Promise<string>(async (resolve, reject) => {
		const bin: string = await baseKamelPath();
		const binpath: string = bin.trim();
		if (!fs.existsSync(binpath)) {
			reject(new Error(`Apache Camel K CLI (kamel) unavailable`));
			return;
		}
	
		const cmd: string = getBaseCmd(binpath, command, namespace);
		const sr: ChildProcess = exec(cmd);
		let wholeOutData: string = '';
		if (sr) {
			if (sr.stdout) {
				sr.stdout.on('data', function (data) {
					if (devMode && devMode === true) {
						utils.shareMessage(extension.mainOutputChannel, `Dev Mode -- ${data}`);
					}
					wholeOutData += data;
				});
			}
			if (sr.stderr) {
				sr.stderr.on('data', function (data) {
					utils.shareMessage(extension.mainOutputChannel, `${data}`);
					reject(new Error(data));
				});
			}
			sr.on('close', function (exitCode, signal) {
				if(exitCode === 0){
					if(wholeOutData !== ''){
						resolve(wholeOutData);
					} else {
						resolve("0");
					}
				} else if(exitCode === null) {
					if (signal === null) {
						reject("Closed with no exit code and no signal.");
					} else {
						reject(signal.toString());
					}
				} else {
					reject(exitCode.toString());
				}
			});
		}
	});
}

async function kamelInternalArgs(args: string[], devMode: boolean, namespace: string | undefined, foldername?: string): Promise<ChildProcess> {
	return new Promise<ChildProcess>(async (resolve, reject) => {
		const bin: string = await baseKamelPath();
		if (bin) {
			const binpath: string = bin.trim();
			if (namespace) {
				args.push(`--namespace=${namespace}`);
			}
			console.log(`command called: ${binpath} with arguments ${args}`);
			let sr : ChildProcess;
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
						const errorMessage: string = `${data}`;
						utils.shareMessage(extension.mainOutputChannel, errorMessage);
						if (errorMessage.includes('no matches for kind "Integration"') && errorMessage.includes('camel.apache.org')) {
							utils.shareMessage(extension.mainOutputChannel,
								'It seems that the targeted container host doesn\'t have Camel K installed.\n'
								+'Please check documentation at https://camel.apache.org/camel-k/latest/installation/installation.html to install it.');
						}
						if (errorMessage.includes('cannot get command client:')) {
							utils.shareMessage(extension.mainOutputChannel,
								'It seems that no container host can be reached.\n'
								+'Please check documentation at https://camel.apache.org/camel-k/latest/installation/installation.html to install one with Camel K.');
						}
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
	const result : FindBinaryResult = await findBinary('kamel');
	if (result && result.output && result.err === null) {
		return result.output.replace('\n', '');
	}
	const bin: string = config.getActiveKamelconfig();
	if (!bin) {
		return 'kamel';
	}
	return path.normalize(bin);
}
