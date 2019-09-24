import { exec, spawn} from "child_process";
import * as child_process from "child_process";
import * as config from './config';
import { Shell, shell } from './shell';
import * as utils from './CamelKJSONUtils';
import * as extension from './extension';
import * as path from 'path';
import * as fs from 'fs';

export interface Kamel {
    devMode : boolean;
    namespace: string;
    getPath() : Promise<string>;
    invoke(command: string): Promise<string>;
    invokeArgs(args: string[], folderName?: string): Promise<child_process.ChildProcess>;
    setDevMode(flag: boolean): void;
    setNamespace(value: string): void;
}

class KamelImpl implements Kamel {
    devMode : boolean = false;
    namespace: string = 'default';
    constructor() {
    }
    async getPath(): Promise<string> {
        const bin = await baseKamelPath();
        return bin;
    }
    async invoke(command: string): Promise<string> {
        return kamelInternal(command, this.devMode);
    }
    invokeArgs(args: string[], folderName?: string): Promise<child_process.ChildProcess> {
        return kamelInternalArgs(args, this.devMode, folderName);
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

async function kamelInternal(command: string, devMode: boolean): Promise<string> {
	return new Promise( async (resolve, reject) => {
        const bin = await baseKamelPath();
        if (!fs.existsSync(bin)) {
            reject(new Error(`Apache Camel K CLI (kamel) unavailable`));
            return;
        }
        const cmd = `${bin} ${command}`;
        const sr = await exec(cmd);
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
                    utils.shareMessage(extension.mainOutputChannel, `Error ${data}`);
                    reject(new Error(data));
                });
                return;
            }				
        }
    });
}

async function kamelInternalArgs(args: string[], devMode: boolean, foldername?: string): Promise<child_process.ChildProcess> {
	return new Promise( async (resolve, reject) => {
        const bin : string = await baseKamelPath();
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
                        if (devMode && devMode === true) {
                            utils.shareMessage(extension.mainOutputChannel, `Dev Mode -- ${data}`);
                        }
                    });
                }        
                if (sr.stderr) {
                    sr.stderr.on('data', function (data) {
                        utils.shareMessage(extension.mainOutputChannel, `Error ${data}`);
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
    let result : FindBinaryResult = await findBinary(shell, 'kamel');
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

async function findBinary(shell: Shell, binName: string): Promise<FindBinaryResult> {
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
