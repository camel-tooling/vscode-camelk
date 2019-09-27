import { exec, spawn} from "child_process";
import * as child_process from "child_process";
import * as config from './config';
import * as shell from './shell';
import * as utils from './CamelKJSONUtils';
import * as extension from './extension';
import * as path from 'path';
import * as fs from 'fs';

export interface Kubectl {
	namespace: string;
	getPath() : Promise<string>;
	invoke(command: string): Promise<string>;
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
	async invoke(command: string): Promise<string> {
		return kubectlInternal(command);
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

async function kubectlInternal(command: string): Promise<string> {
	return new Promise( async (resolve, reject) => {
		const bin = await baseKubectlPath();
		if (!fs.existsSync(bin)) {
			reject(new Error(`Kubernetes CLI (kubectl) unavailable`));
			return;
		}
		const cmd = `${bin} ${command}`;
		const sr = await exec(cmd);
		if (sr) {
			if (sr.stdout) {
				sr.stdout.on('data', function (data) {
					console.log(data);
					resolve(data);
				});
				return;
			}        
			if (sr.stderr) {
				sr.stderr.on('data', function (error) {
					utils.shareMessage(extension.mainOutputChannel, `Error ${error}`);
					reject(new Error(error));
				});
				return;
			}
			sr.on("close", () => {
				resolve('close');
				return;
			});            
		}
	});
}

async function kubectllInternalArgs(args: string[], foldername?: string): Promise<child_process.ChildProcess> {
	return new Promise( async (resolve, reject) => {
		const bin : string = await baseKubectlPath();
		if (bin) {
			const binpath = bin.trim();
			let sr : child_process.ChildProcess;
			if (foldername) {
				sr = await spawn(binpath, args, { cwd : foldername});
			} else {
				sr = await spawn(binpath, args);
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
