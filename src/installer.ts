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
import fetch from 'node-fetch';
import * as kamelCli from './kamel';
import * as shell from './shell';
import * as vscode from 'vscode';
import * as kubectlutils from './kubectlutils';
import * as versionUtils from './versionUtils';
import * as mkdirp from 'mkdirp';
import * as tar from 'tar';

export const kamel = 'kamel';
export const kamel_windows = 'kamel.exe';
export const platform = shell.getPlatform();
const binFile: string = (!shell.isWindows()) ? kamel : kamel_windows;

export async function isKamelAvailable(): Promise<boolean> {
	try {
		const kamelLocal = kamelCli.create();
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

async function downloadAndExtract(link: string, dlFilename: string, installFolder: string): Promise<boolean> {
	const myStatusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	extension.mainOutputChannel.appendLine('Downloading from: ' + link);
	updateStatusBarItem(myStatusBarItem, 'Downloading...', `Downloading ${dlFilename}...`);
	try {
		const response = await fetch(link);
		const tmpDirectory = fs.mkdtempSync(`camelk-downloadandextract-${dlFilename}`);
		const tmpTar = path.join(tmpDirectory, dlFilename);
		await fs.promises.writeFile(tmpTar, await response.buffer());
		extension.mainOutputChannel.appendLine(`Downloaded ${dlFilename}.`);
		updateStatusBarItem(myStatusBarItem, 'Extracting...', `Extracting ${dlFilename}...`);
		tar.extract({
			cwd: installFolder,
			file: tmpTar,
			sync: true,
		});
		extension.mainOutputChannel.appendLine(`Extracted ${dlFilename}.`);
		return true;
	} catch (error) {
		console.log(`Error during download and extract of ${dlFilename}:\n${error}`);
		return false;
	} finally {
		myStatusBarItem.dispose();
	}
}

async function download(link: string, dlFilename: string, installFolder: string): Promise<boolean> {
	const myStatusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	extension.mainOutputChannel.appendLine('Downloading from: ' + link);
	updateStatusBarItem(myStatusBarItem, 'Downloading...', `Downloading ${dlFilename}...`);
	try {
		const response = await fetch(link);
		fs.mkdirSync(installFolder, { recursive: true });
		await fs.promises.writeFile(path.join(installFolder, dlFilename), await response.buffer());
		extension.mainOutputChannel.appendLine(`Downloaded ${dlFilename}.`);
		return true;
	} catch (error) {
		console.log(`Error during download of ${dlFilename}:\n${error}`);
		return false;
	} finally {
		myStatusBarItem.dispose();
	}
}

function updateStatusBarItem(sbItem: vscode.StatusBarItem, text: string, tooltip: string): void {
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
	const autoUpgrade: boolean = config.getKamelAutoupgradeConfig();
	if (runtimeVersionSetting && runtimeVersionSetting.toLowerCase() !== versionUtils.version.toLowerCase()) {
		const runtimeVersionAvailable = await versionUtils.testVersionAvailable(runtimeVersionSetting);
		if (!runtimeVersionAvailable) {
			const unavailableMsg = `Camel K CLI Version ${runtimeVersionSetting} unavailable. Will use default version ${versionUtils.version}`;
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
	} catch (error) {
		console.error(error);
	}

	const installFolder: string = getInstallFolder(kamel, context);
	console.log(`Attempting to download Apache Camel K CLI to ${installFolder}`);
	mkdirp.sync(installFolder);

	let kamelUrl = '';
	if (platform !== undefined && versionToUse) {
		try {
			kamelUrl = await versionUtils.getDownloadURLForCamelKTag(versionToUse, platform);
		} catch (error) {
			const errMessage = error instanceof Error ? error.message : String(error);
			extension.shareMessageInMainOutputChannel(errMessage);
			throw new Error(errMessage);
		}
	}

	const msg = `Camel K CLI Version ${versionToUse} unavailable. Please check the Apache Camel K version specified in VS Code Settings. Inaccessible url: ${kamelUrl}`;
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
		const flag = await downloadAndExtract(kamelUrl, kamelCliFile, installFolder);
		console.log(`Downloaded ${downloadFile} successfully: ${flag}`);
		if (fs.existsSync(downloadFile)) {
			if (shell.isUnix()) {
				fs.chmodSync(downloadFile, '0700');
			}
			await config.addKamelPathToConfig(downloadFile);
		}
	} catch (error) {
		console.log(`Error during install of kamel CLI:\n${error}`);
		return { succeeded: false, error: [`Failed to download kamel: ${error}`] };
	}

	return { succeeded: true, result: null };
}

function getInstallFolder(tool: string, context: vscode.ExtensionContext): string {
	return path.join(context.globalStoragePath, `camelk/tools/${tool}`);
}

async function getStableKubectlVersion(): Promise<Errorable<string>> {
	const response = await fetch('https://storage.googleapis.com/kubernetes-release/release/stable.txt');
	if (response.status === 200) {
		return { succeeded: true, result: await response.text() };
	} else {
		return { succeeded: false, error: [`Failed to establish kubectl stable version: ${response.statusText}`] };
	}
}

function getKubectlInstallFolder(tool: string): string {
	return path.join(shell.home(), `.vs-kubernetes/tools/${tool}`);
}

function toKubectlOsString(platform: shell.Platform | undefined): string | undefined {
	switch (platform) {
		case shell.Platform.WINDOWS:
			return 'windows';
		case shell.Platform.LINUX:
			return 'linux';
		case shell.Platform.MACOS:
			return 'darwin';
	}
	return undefined;
}

export async function installKubectl(context: vscode.ExtensionContext): Promise<Errorable<null>> {
	const tool = 'kubectl';
	const executable: string = (shell.isUnix() || shell.isMacOS()) ? tool : `${tool}.exe`;
	const osString = toKubectlOsString(platform);
	const version: Errorable<string> = await getStableKubectlVersion();
	if (failed(version)) {
		return { succeeded: false, error: version.error };
	}

	const installFolder: string = getKubectlInstallFolder(tool);
	console.log(`Downloading Kubernetes CLI to ${installFolder}`);
	mkdirp.sync(installFolder);

	const kubectlUrl = `https://storage.googleapis.com/kubernetes-release/release/${version.result.trim()}/bin/${osString}/amd64/${executable}`;
	const downloadFile: string = path.join(installFolder, executable);

	extension.shareMessageInMainOutputChannel(`Downloading Kubernetes cli tool from ${kubectlUrl} to ${downloadFile}`);

	try {
		const flag: boolean = await download(kubectlUrl, executable, installFolder);
		console.log(`Downloaded ${downloadFile} successfully: ${flag}`);
	} catch (error) {
		console.log(`Error during install of kubectl CLI:\n${error}`);
		return { succeeded: false, error: [`Failed to download kubectl: ${error}`] };
	}
	await config.addKubectlPathToConfig(downloadFile);

	if (shell.isUnix() || shell.isMacOS()) {
		fs.chmodSync(downloadFile, '0700');
	}

	return { succeeded: true, result: null };
}
