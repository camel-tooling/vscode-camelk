'use strict';

import { ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import * as shelljs from 'shelljs';

export enum Platform {
    Windows,
    MacOS,
    Linux,
    Unsupported,  // shouldn't happen!
}

export interface ExecCallback extends shelljs.ExecCallback {}

export interface Shell {
    isWindows(): boolean;
    isUnix(): boolean;
    home(): string;
    exec(cmd: string, stdin?: string): Promise<ShellResult | undefined>;
    execCore(cmd: string, opts: any, callback?: (proc: ChildProcess) => void, stdin?: string): Promise<ShellResult>;
}

export const shell: Shell = {
    isWindows : isWindows,
    isUnix : isUnix,
    home : home,
    exec : exec,
    execCore : execCore
};

const WINDOWS: string = 'win32';

export interface ShellResult {
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
}

export type ShellHandler = (code: number, stdout: string, stderr: string) => void;

function isWindows(): boolean {
    return (process.platform === WINDOWS);// && !getUseWsl();
}

function isUnix(): boolean {
    return !isWindows();
}

function concatIfBoth(s1: string | undefined, s2: string | undefined): string | undefined {
    return s1 && s2 ? s1.concat(s2) : undefined;
}

function home(): string {
    // if (getUseWsl()) {
    //     return shelljs.exec('wsl.exe echo ${HOME}').stdout.trim();
    // }
    return process.env['HOME'] ||
        concatIfBoth(process.env['HOMEDRIVE'], process.env['HOMEPATH']) ||
        process.env['USERPROFILE'] ||
        '';
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

async function exec(cmd: string, stdin?: string): Promise<ShellResult | undefined> {
    try {
        return await execCore(cmd, execOpts(), null, stdin);
    } catch (ex) {
        vscode.window.showErrorMessage(ex);
        return undefined;
    }
}

function execOpts(): any {
    let env = process.env;
    if (isWindows()) {
        env = Object.assign({ }, env, { HOME: home() });
    }
    const opts = {
        cwd: vscode.workspace.rootPath,
        env: env,
        async: true
    };
    return opts;
}