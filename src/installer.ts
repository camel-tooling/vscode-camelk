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
import * as mkdirp from 'mkdirp';

export const kamel = 'kamel';
export const kamel_windows = 'kamel.exe';
export const platformString = shell.getPlatform(); // looks for windows, mac, linux
const binFile: string = (!shell.isWindows()) ? kamel : kamel_windows;

export async function isKamelAvailable() : Promise<boolean> {
	try { 
		let kamelLocal = kamelCli.create();
		const rtnValue: string = await kamelLocal.invoke('--help');
		return rtnValue.startsWith('Apache Camel K');
	} catch (error) {
		Promise.reject(error);
		return false;
	}
}

export async function isKubernetesAvailable(): Promise<boolean> {
	return await kubectlutils.getKubernetesVersion() !== undefined;
}

async function downloadAndExtract(link : string, dlFilename: string, installFolder : string, extractFlag : boolean) : Promise<boolean> {
	const myStatusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	const downloadSettings: any = {
		filename: `${dlFilename}`,
		extract: extractFlag,
	};
	extension.mainOutputChannel.appendLine('Downloading from: ' + link);
	await download(link, installFolder, downloadSettings)
		.on('response', (response) => {
			extension.mainOutputChannel.appendLine(`Bytes to transfer: ${response.headers['content-length']}`);
		}).on('downloadProgress', (progress) => {
			const incr: number = progress.total > 0 ? Math.floor(progress.transferred / progress.total * 100) : 0;
			const percent: number = Math.round(incr);
			const message: string = `Download progress: ${progress.transferred} / ${progress.total} (${percent}%)`;
			const tooltip: string = `Download progress for ${dlFilename}`;
			updateStatusBarItem(myStatusBarItem, message, tooltip);
		}).then(() => {
			extension.mainOutputChannel.appendLine(`Downloaded ${dlFilename}.`);
			myStatusBarItem.dispose();
			return true;
		}).catch((error) => {
			console.log(error);
		}).finally( () => {
			myStatusBarItem.dispose();
		});
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
	let versionToUse: string = versionUtils.version;
	const runtimeVersionSetting: string | undefined = vscode.workspace.getConfiguration().get(config.RUNTIME_VERSION_KEY);
	const autoUpgrade : boolean = config.getKamelAutoupgradeConfig();
	if (runtimeVersionSetting && runtimeVersionSetting.toLowerCase() !== versionUtils.version.toLowerCase()) {
		const runtimeVersionAvailable = await versionUtils.testVersionAvailable(runtimeVersionSetting);
		if (!runtimeVersionAvailable) {
			const unavailableMsg: string = `Camel K CLI Version ${runtimeVersionSetting} unavailable. Will use default version ${versionUtils.version}`;
			extension.shareMessageInMainOutputChannel(unavailableMsg);
			versionToUse = versionUtils.version;
		} else {
			versionToUse = runtimeVersionSetting;
		}
	} else if (autoUpgrade) {
		const latestversion: Errorable<string> = await versionUtils.getLatestCamelKVersion();
		if (failed(latestversion)) {
			extension.shareMessageInMainOutputChannel(`Cannot retrieve latest available Camel version and none has been specified in settings. Will fall back to use the default ${versionUtils.version}`);
			versionToUse = versionUtils.version;
		} else {
			versionToUse = latestversion.result.trim();
			extension.shareMessageInMainOutputChannel(`Auto-upgrade is enabled and a new version of the Camel K CLI was discovered. Will use new version ${versionToUse}`);
			await config.setKamelRuntimeVersionConfig(versionToUse);
			extension.setRuntimeVersionSetting(versionToUse);
		}
	}

	try {
		const needsUpdate: boolean = await versionUtils.checkKamelNeedsUpdate(versionToUse);
		if (needsUpdate) {
			extension.shareMessageInMainOutputChannel(`Checking to see if Apache Camel K CLI version ${versionToUse} available`);
		}
	} catch ( error ) {
		console.error(error);
	}

	const installFolder: string = getInstallFolder(kamel, context);
	console.log(`Attempting to download Apache Camel K CLI to ${installFolder}`);
	mkdirp.sync(installFolder);

	let kamelUrl : string = '';
	if (platformString && versionToUse) {
		try {
			kamelUrl = await versionUtils.getDownloadURLForCamelKTag(versionToUse, platformString);
		} catch (error) {
			extension.shareMessageInMainOutputChannel(error);
			throw new Error(error);
		}
	}

	var msg = `Camel K CLI Version ${versionToUse} unavailable. Please check the Apache Camel K version specified in VS Code Settings. Inaccessible url: ${kamelUrl}`;
	if (!kamelUrl && kamelUrl.length === 0) {
		extension.shareMessageInMainOutputChannel(msg);
		throw new Error(msg);
	}

	const result: boolean = await versionUtils.pingGithubUrl(kamelUrl);
	if (!result) {
		extension.shareMessageInMainOutputChannel(msg);
		throw new Error(msg);
	}

	const kamelCliFile: string = path.parse(kamelUrl).base;
	const downloadFile: string = path.join(installFolder, binFile);
	extension.shareMessageInMainOutputChannel(`Downloading kamel cli tool from ${kamelUrl} to ${downloadFile}`);

	try { 
		const flag = await downloadAndExtract(kamelUrl, kamelCliFile, installFolder, true);
		console.log(`Downloaded ${downloadFile} successfully: ${flag}`);
		if (fs.existsSync(downloadFile)) {
			if (shell.isUnix()) {
				fs.chmodSync(downloadFile, '0700');
			}
	 		await config.addKamelPathToConfig(downloadFile);
		}
	} catch( error ) {
		console.log(error);
		return { succeeded: false, error: [`Failed to download kamel: ${error}`] };
	}

	return { succeeded: true, result: null };
}

function getInstallFolder(tool: string, context : vscode.ExtensionContext): string {
	return path.join(context.globalStoragePath, `camelk/tools/${tool}`);
}

async function getStableKubectlVersion(): Promise<Errorable<string>> {
	const downloadResult: Errorable<string> = await downloader.toTempFile('https://storage.googleapis.com/kubernetes-release/release/stable.txt');
	if (failed(downloadResult)) {
		return { succeeded: false, error: [`Failed to establish kubectl stable version: ${downloadResult.error[0]}`] };
	}
	const version: string = fs.readFileSync(downloadResult.result, 'utf-8');
	fs.unlinkSync(downloadResult.result);
	return { succeeded: true, result: version };
}

function getKubectlInstallFolder(tool: string): string {
	return path.join(shell.home(), `.vs-kubernetes/tools/${tool}`);
}

export async function installKubectl(context: vscode.ExtensionContext): Promise<Errorable<null>> {
	const tool: string = 'kubectl';
	const executable: string = (shell.isUnix() || shell.isMacOS()) ? tool : `${tool}.exe`;
	const os: string | undefined = shell.getPlatform();
	let osString: string | undefined = os; // user looks for strings windows, darwin, linux
	if (osString === 'win32') {
		osString = 'windows';
	}

	const version: Errorable<string> = await getStableKubectlVersion();
	if (failed(version)) {
		return { succeeded: false, error: version.error };
	}

	const installFolder: string = getKubectlInstallFolder(tool);
	console.log(`Downloading Kubernetes CLI to ${installFolder}`);
	mkdirp.sync(installFolder);

	const kubectlUrl: string = `https://storage.googleapis.com/kubernetes-release/release/${version.result.trim()}/bin/${osString}/amd64/${executable}`;
	const downloadFile: string = path.join(installFolder, executable);

	extension.shareMessageInMainOutputChannel(`Downloading Kubernetes cli tool from ${kubectlUrl} to ${downloadFile}`);

	try { 
		const flag: boolean = await downloadAndExtract(kubectlUrl, executable, installFolder, true);
		console.log(`Downloaded ${downloadFile} successfully: ${flag}`);
	} catch (error) {
		console.log(error);
		return { succeeded: false, error: [`Failed to download kubectl: ${error}`] };
	}
	await config.addKubectlPathToConfig(downloadFile);

	if (shell.isUnix() || shell.isMacOS()) {
		fs.chmodSync(downloadFile, '0700');
	}

	return { succeeded: true, result: null };
}
