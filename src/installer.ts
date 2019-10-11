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

const downloadTarball = require('download-tarball');

export const kamel = 'kamel';
export const kamel_windows = 'kamel.exe';
export const version = '1.0.0-M2'; //need to retrieve this if possible, but have a default
export const PLATFORM_WINDOWS = 'windows';
export const PLATFORM_MAC = 'mac';
export const PLATFORM_LINUX = 'linux';

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
			}).catch ( (error) => {
				console.log(`Apache Camel K CLI (kamel) unavailable: ${error}`);
				reject(new Error(error));
				return;
		});
	});
}

export function checkKamelCLIVersion() : Promise<string> {
	return new Promise<string>( async (resolve, reject) => {
		let kamelLocal = kamelCli.create();
		await kamelLocal.invoke('version')
			.then( (rtnValue) => {
				const strArray = rtnValue.split(' ');
				const version = strArray[strArray.length - 1].trim();
				console.log(`Apache Camel K CLI (kamel) version returned: ${version}`);
				resolve(version);
				return;
			}).catch ( (error) => {
				console.log(`Apache Camel K CLI (kamel) unavailable: ${error}`);
				reject(new Error(error));
				return;
		});
	});
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

export async function installKamel(context: vscode.ExtensionContext): Promise<Errorable<null>> {
	await checkKamelCLIVersion().then((currentVersion) => {
		if (version.toLowerCase() === currentVersion.toLowerCase()) {
			// no need to install, it's already here
			extension.shareMessageInMainOutputChannel(`Apache Camel K CLI version ${currentVersion} available`);
			return { succeeded: true, result: null };
		}
	}).catch ( (error) => {
		console.error(error);
	});

	const platformString = getPlatform(); // looks for windows, mac, linux
	const isWindows = (platformString === 'windows');
	const binFile = (!isWindows) ? kamel : kamel_windows;

	const installFolder = getInstallFolder(kamel, context);
	console.log(`Downloading Apache Camel K CLI to ${installFolder}`);
	mkdirp.sync(installFolder);

	const kamelUrl = `https://github.com/apache/camel-k/releases/download/${version}/camel-k-client-${version}-${platformString}-64bit.tar.gz`;
	const downloadFile = path.join(installFolder, binFile);

	extension.shareMessageInMainOutputChannel(`Downloading kamel cli tool from ${kamelUrl} to ${downloadFile}`);

	await grabTarGzAndUnGZ(kamelUrl, installFolder).then( async (flag) => {
		console.log(`Downloaded ${downloadFile} successfully: ${flag}`);
		try {
			if (fs.existsSync(downloadFile)) {
				if (shell.isUnix()) {
					fs.chmodSync(downloadFile, '0777');
				}
				await config.addKamelPathToConfig(downloadFile);
			}
		  } catch(err) {
			console.error(err);
			return { succeeded: false, error: [`Failed to download kamel: ${err}`] };
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

async function grabTarGzAndUnGZ(fileUrl: string, directory: string) : Promise<boolean>{
	return new Promise<boolean>( (resolve, reject) => {
		downloadTarball({
			url: fileUrl,
			dir: directory
		  }).then(() => {
			resolve(true);
			return;
		  }).catch( (err: any) => {
			  reject(err);
			  return;
		  });
	});
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
	const binFile = (shell.isUnix()) ? tool : `${tool}.exe`;
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

	const downloadResult = await downloader.to(kubectlUrl, downloadFile);
	if (failed(downloadResult)) {
		return { succeeded: false, error: [`Failed to download kubectl: ${downloadResult.error[0]}`] };
	}
	await config.addKubectlPathToConfig(downloadFile);

	if (shell.isUnix()) {
		fs.chmodSync(downloadFile, '0777');
	}

	return { succeeded: true, result: null };
}
