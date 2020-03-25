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

import * as path from 'path';
import * as fs from 'fs';
import mkdirp = require('mkdirp');
import {platform} from 'os';
import { Errorable, failed } from './errorable';
import * as extension from './extension';
import * as config from './config';
import * as kamelCli from './kamel';
import * as shell from './shell';
import * as vscode from 'vscode';
import * as kubectlutils from './kubectlutils';
import * as downloader from './downloader';
import * as download from 'download';
import * as versionUtils from './versionUtils';

export const kamel = 'kamel';
export const kamel_windows = 'kamel.exe';
export const PLATFORM_WINDOWS = 'windows';
export const PLATFORM_MAC = 'mac';
export const PLATFORM_LINUX = 'linux';

export const platformString = getPlatform(); // looks for windows, mac, linux
const isWindows = (platformString === 'windows');
const binFile = (!isWindows) ? kamel : kamel_windows;

export function isKamelAvailable() : Promise<boolean> {
	return new Promise<boolean>( async (resolve, reject) => {
		let kamelLocal = kamelCli.create();
		await kamelLocal.invoke('--help')
			.then( (rtnValue) => {
				if (rtnValue.startsWith('Apache Camel K')) {
					resolve(true);
					return;
				} else {
					resolve(false);
					return;
				}
			}).catch (kamelUnavailableRejection(reject));
	});
}

export function kamelUnavailableRejection(reject: (reason?: any) => void): ((reason: any) => void | PromiseLike<void>) | null | undefined {
	return (error) => {
		console.log(`Apache Camel K CLI (kamel) unavailable: ${error}`);
		reject(new Error(error));
		return;
	};
}

export function isKubernetesAvailable(): Promise<boolean> {
	return new Promise<boolean>( async (resolve, reject) => {
		const version = await kubectlutils.getKubernetesVersion();
		if (version) {
			resolve(true);
			return;
		}
		reject (new Error('No kubectl version found'));
		return;
	});
}

export function getPlatform() : string | undefined {
	const os = platform();
	const isWindows = (os === 'win32');
	const isMac = (os === 'darwin');
	const isLinux = (os === 'linux');

	if (isWindows) { return PLATFORM_WINDOWS; }
	if (isMac) { return PLATFORM_MAC; }
	if (isLinux) { return PLATFORM_LINUX; }
	return undefined;
}

async function downloadAndExtract(link : string, dlFilename: string, installFolder : string, extractFlag : boolean) : Promise<boolean> {
	let myStatusBarItem: vscode.StatusBarItem;
	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

	const downloadSettings = {
		filename: `${dlFilename}`,
		extract: extractFlag,
	  };
	extension.mainOutputChannel.appendLine('Downloading from: ' + link);
	await download(link, installFolder, downloadSettings)
		.on('response', (response) => {
			extension.mainOutputChannel.appendLine(`Bytes to transfer: ${response.headers['content-length']}`);
		}).on('downloadProgress', (progress) => {
			let incr = progress.total > 0 ? Math.floor(progress.transferred / progress.total * 100) : 0;
			let percent = Math.round(incr);
			let message = `Download progress: ${progress.transferred} / ${progress.total} (${percent}%)`;
			let tooltip = `Download progress for ${dlFilename}`;
			updateStatusBarItem(myStatusBarItem, message, tooltip);
		}).then(async () => {
			extension.mainOutputChannel.appendLine(`Downloaded ${dlFilename}.`);
			myStatusBarItem.dispose();
			return true;
		}).catch((error) => {
			console.log(error);
		});
	myStatusBarItem.dispose();
	return false;
}

function updateStatusBarItem(sbItem : vscode.StatusBarItem, text: string, tooltip : string): void {
	if (text) {
		sbItem.text = text;
		sbItem.tooltip = tooltip;
		sbItem.show();
	} else {
		sbItem.hide();
	}
}

export async function installKamel(context: vscode.ExtensionContext): Promise<Errorable<null>> {
	let versionToUse: string;
	let runtimeVersionSetting = vscode.workspace.getConfiguration().get(config.RUNTIME_VERSION_KEY) as string;
	if (runtimeVersionSetting && runtimeVersionSetting.toLowerCase() !== versionUtils.version.toLowerCase()) {
		versionToUse = runtimeVersionSetting;
	} else {
		const latestversion = await versionUtils.getLatestCamelKVersion();
		if (failed(latestversion)) {
			extension.shareMessageInMainOutputChannel(`Cannot retrieve latest available Camel version and none specified in settings. Will fallback to use the default ${versionUtils.version}`);
			versionToUse = versionUtils.version;
		} else {
			versionToUse = latestversion.result.trim();
		}
	}

	await versionUtils.checkKamelNeedsUpdate(versionToUse).then((needsUpdate) => {
		if (needsUpdate) {
			extension.shareMessageInMainOutputChannel(`Checking to see if Apache Camel K CLI version ${versionToUse} available`);
			return { succeeded: true, result: null };
		}
	}).catch ( (error) => {
		console.error(error);
	});

	const installFolder = getInstallFolder(kamel, context);
	console.log(`Attempting to download Apache Camel K CLI to ${installFolder}`);
	mkdirp.sync(installFolder);

	const kamelUrl = `https://github.com/apache/camel-k/releases/download/${versionToUse}/camel-k-client-${versionToUse}-${platformString}-64bit.tar.gz`;
	const kamelCliFile = `camel-k-client-${versionToUse}-${platformString}-64bit.tar.gz`;
	const downloadFile = path.join(installFolder, binFile);

	await versionUtils.pingGithubUrl(kamelUrl).then( (result) => {
		if (!result) {
			var msg = `Camel K CLI Version ${versionToUse} unavailable. Please check the Apache Camel K version specified in VS Code Settings. Inaccessible url: ${kamelUrl}`;
			extension.shareMessageInMainOutputChannel(msg);
			throw new Error(msg);
		}
	});

	extension.shareMessageInMainOutputChannel(`Downloading kamel cli tool from ${kamelUrl} to ${downloadFile}`);

	await downloadAndExtract(kamelUrl, kamelCliFile, installFolder, true)
	.then( async (flag) => {
		console.log(`Downloaded ${downloadFile} successfully: ${flag}`);
		if (fs.existsSync(downloadFile)) {
			if (shell.isUnix()) {
				fs.chmodSync(downloadFile, '0700');
			}
	 		await config.addKamelPathToConfig(downloadFile);
		}
	})
	.catch ( (error) => {
		console.log(error);
		return { succeeded: false, error: [`Failed to download kamel: ${error}`] };
	});

	return { succeeded: true, result: null };
}

function getInstallFolder(tool: string, context : vscode.ExtensionContext): string {
	return path.join(context.globalStoragePath, `camelk/tools/${tool}`);
}

async function getStableKubectlVersion(): Promise<Errorable<string>> {
	const downloadResult = await downloader.toTempFile('https://storage.googleapis.com/kubernetes-release/release/stable.txt');
	if (failed(downloadResult)) {
		return { succeeded: false, error: [`Failed to establish kubectl stable version: ${downloadResult.error[0]}`] };
	}
	const version = fs.readFileSync(downloadResult.result, 'utf-8');
	fs.unlinkSync(downloadResult.result);
	return { succeeded: true, result: version };
}

function concatIfBoth(s1: string | undefined, s2: string | undefined): string | undefined {
	return s1 && s2 ? s1.concat(s2) : undefined;
}

function home(): string {
	return process.env['HOME'] ||
		concatIfBoth(process.env['HOMEDRIVE'], process.env['HOMEPATH']) ||
		process.env['USERPROFILE'] ||
		'';
}

function getKubectlInstallFolder(tool: string): string {
	return path.join(home(), `.vs-kubernetes/tools/${tool}`);
}

export async function installKubectl(context: vscode.ExtensionContext): Promise<Errorable<null>> {
	const tool = 'kubectl';
	const binFile = (shell.isUnix() || shell.isMacOS()) ? tool : `${tool}.exe`;
	const os = shell.getPlatform();
	let osString = os; // user looks for strings windows, darwin, linux
	if (osString === 'win32') {
		osString = 'windows';
	}

	const version = await getStableKubectlVersion();
	if (failed(version)) {
		return { succeeded: false, error: version.error };
	}

	const installFolder = getKubectlInstallFolder(tool);
	console.log(`Downloading Kubernetes CLI to ${installFolder}`);
	mkdirp.sync(installFolder);

	const kubectlUrl = `https://storage.googleapis.com/kubernetes-release/release/${version.result.trim()}/bin/${osString}/amd64/${binFile}`;
	const downloadFile = path.join(installFolder, binFile);

	extension.shareMessageInMainOutputChannel(`Downloading Kubernetes cli tool from ${kubectlUrl} to ${downloadFile}`);

	await downloadAndExtract(kubectlUrl, binFile, installFolder, true)
	.then( async (flag) => {
		console.log(`Downloaded ${downloadFile} successfully: ${flag}`);
	}).catch ( (error) => {
		console.log(error);
		return { succeeded: false, error: [`Failed to download kubectl: ${error}`] };
	});
	await config.addKubectlPathToConfig(downloadFile);

	if (shell.isUnix() || shell.isMacOS()) {
		fs.chmodSync(downloadFile, '0700');
	}

	return { succeeded: true, result: null };
}
