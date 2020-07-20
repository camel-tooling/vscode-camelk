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

import { ChildProcess } from 'child_process';
import * as shelljs from 'shelljs';

const WINDOWS: string = 'win32';
const MACOS : string = 'darwin';
const LINUX : string = 'linux';

export interface FindBinaryResult {
	err: number | null;
	output: string;
}

export function concatIfBoth(s1: string | undefined, s2: string | undefined): string | undefined {
    return s1 && s2 ? s1.concat(s2) : undefined;
}

export function home(): string {
    return process.env['HOME'] ||
        concatIfBoth(process.env['HOMEDRIVE'], process.env['HOMEPATH']) ||
        process.env['USERPROFILE'] ||
        '';
}

export function isWindows(): boolean {
    return (process.platform === WINDOWS);
}

export function isMacOS(): boolean {
    return (process.platform === MACOS);
}

export function isUnix(): boolean {
    return (process.platform === LINUX);
}

export function getPlatform() : string | undefined {
    if (isWindows()) { return WINDOWS; }
    if (isMacOS()) { return MACOS; }
    if (isUnix()) { return LINUX; }
    return undefined;
}

export function execCore(cmd: string, opts: any, callback?: ((proc: ChildProcess) => void) | null, stdin?: string): Promise<ShellResult> {
    return new Promise<ShellResult>((resolve) => {
        const proc = shelljs.exec(cmd, opts, (code, stdout, stderr) => resolve({code : code, stdout : stdout, stderr : stderr}));
        if (stdin &&  proc.stdin) {
            proc.stdin.end(stdin);
        }
        if (callback) {
            callback(proc);
        }
    });
}

export interface ShellResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

export async function findBinary(binName: string): Promise<FindBinaryResult> {
	let cmd = `which ${binName}`;

	if (isWindows()) {
		cmd = `where.exe ${binName}.exe`;
	}

	const opts = {
		async: true,
		env: {
			HOME: process.env.HOME,
			PATH: process.env.PATH
		}
	};

	const execResult = await execCore(cmd, opts);
	if (execResult.code) {
		return { err: execResult.code, output: execResult.stderr };
	}

	return { err: null, output: execResult.stdout };
}
