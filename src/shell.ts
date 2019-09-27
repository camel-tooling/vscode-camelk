'use strict';

import { ChildProcess } from 'child_process';
import * as shelljs from 'shelljs';

const WINDOWS: string = 'win32';

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

export function isUnix(): boolean {
    return !isWindows();
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