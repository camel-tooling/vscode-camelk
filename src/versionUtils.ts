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
import * as vscode from 'vscode';
import * as extension from './extension';
import { Errorable, failed } from './errorable';
import * as config from './config';
import * as kamelCli from './kamel';
import { platformString, kamelUnavailableRejection } from './installer';
import fetch from 'cross-fetch';

export const version: string = '1.0.0-RC2'; //need to retrieve this if possible, but have a default
/*
* Can be retrieved using `curl -i https://api.github.com/repos/apache/camel-k/releases/latest` and searchign for "last-modified" attribute
* To be updated when updating the default "version" attribute
*/
const LAST_MODIFIED_DATE_OF_DEFAULT_VERSION: string = 'Fri, 28 Feb 2020 07:24:17 GMT';
let latestVersionFromOnline: string;

async function testVersionAvailable(versionToUse: string): Promise<boolean> {
	return new Promise<boolean>(async (resolve) => {
		if (versionToUse) {
			const kamelUrl = `https://github.com/apache/camel-k/releases/download/${versionToUse}/camel-k-client-${versionToUse}-${platformString}-64bit.tar.gz`;

			await pingGithubUrl(kamelUrl).then((result) => {
				resolve(result);
			});
		}
		resolve(false);
	});
}

export async function checkKamelNeedsUpdate(versionToUse?: string): Promise<boolean> {
	return new Promise<boolean>(async (resolve, reject) => {
		let runtimeVersionSetting = vscode.workspace.getConfiguration().get(config.RUNTIME_VERSION_KEY) as string;

		if (versionToUse) {
			let thisVersionAvailable = await testVersionAvailable(versionToUse);
			if (!thisVersionAvailable) {
				var msg = `Camel K CLI Version ${versionToUse} unavailable.`;
				extension.shareMessageInMainOutputChannel(msg);
				reject(new Error(msg));
				return false;
			}
		} else if (!versionToUse) {
			const latestversion = await getLatestCamelKVersion();
			if (failed(latestversion)) {
				console.error(latestversion.error);
				resolve(true);
				return true;
			}
			versionToUse = latestversion.result.trim();
		}

		if (runtimeVersionSetting && runtimeVersionSetting.toLowerCase() !== versionToUse.toLowerCase()) {
			versionToUse = runtimeVersionSetting;
			extension.shareMessageInMainOutputChannel(`Using Apache Camel K CLI version ${versionToUse} instead of latest version ${version}`);
		}

		if (versionToUse) {
			await checkKamelCLIVersion().then((currentVersion) => {
				if (versionToUse && versionToUse.toLowerCase() === currentVersion.toLowerCase()) {
					// no need to install, it's already here
					resolve(false);
					return false;
				} else {
					resolve(true);
					return true;
				}
			}).catch((error) => {
				console.error(error);
				resolve(true);
				return true;
			});
		}
	});
}

export async function pingGithubUrl(urlStr: string): Promise<boolean> {
	// placeholder to ensure that this url path is accessible
	console.log(`Validate that ${urlStr} is accessible`);
	try {
		const res = await fetch(urlStr);
		if (res.status === 200) {
			return Promise.resolve(true);
		}
		return Promise.resolve(false);
	} catch (err) {
		return Promise.resolve(false);
	}
}

export async function getLatestCamelKVersion(): Promise<Errorable<string>> {
	if (latestVersionFromOnline) {
		return { succeeded: true, result: latestVersionFromOnline };
	} else {
		const latestURL = 'https://api.github.com/repos/apache/camel-k/releases/latest';
		const headers = [['If-Modified-Since', LAST_MODIFIED_DATE_OF_DEFAULT_VERSION]];
		let githubToken = process.env.VSCODE_CAMELK_GITHUB_TOKEN;
		if(githubToken) {
			headers.push(['Authorization', `token ${githubToken}`]);
		}
		const res = await fetch(latestURL, { headers: headers });
		if (res.status === 200) {
			let latestJSON = await res.json();
			let tagName = latestJSON.tag_name;
			if (tagName) {
				latestVersionFromOnline = tagName;
				return { succeeded: true, result: tagName };
			} else {
				return { succeeded: false, error: [`Failed to retrieve latest Apache Camel K version tag from : ${latestURL}`] };
			}
		} else if (res.status === 304) {
			latestVersionFromOnline = version;
			return { succeeded: true, result: latestVersionFromOnline };
		} else {
			console.log(`error ${res.status} ${res.statusText}`);
			return { succeeded: false, error: [`Failed to establish Apache Camel K stable version: ${res.status} ${res.statusText}`] };
		}
	}
}

function checkKamelCLIVersion(): Promise<string> {
	return new Promise<string>(async (resolve, reject) => {
		let kamelLocal = kamelCli.create();
		await kamelLocal.invoke('version')
			.then((rtnValue) => {
				const strArray = rtnValue.split(' ');
				const version = strArray[strArray.length - 1].trim();
				console.log(`Apache Camel K CLI (kamel) version returned: ${version}`);
				resolve(version);
				return;
			}).catch(kamelUnavailableRejection(reject));
	});
}

export async function handleChangeRuntimeConfiguration() {
	let runtimeSetting = config.getKamelRuntimeVersionConfig();
	let newUpgradeSetting = config.getKamelAutoupgradeConfig();

	/* 
		This series of IF statements can be a bit tricky to follow.
		
		The first IF (newUpgradeSetting === true) handles the standard auto-upgrade case.
		If the user sets it to true, we simply override whatever is there with the version we specify as the default.
		We will need to make sure we keep 'version' in sync with the latest supported runtime version.

		The second IF (extension.runtimeVersionSetting) checks to see if there was already an override version specified.
		The extension 'runtimeVersionSetting' is loaded at startup from the global settings and may still be undefined if the 
		user had auto-upgrade = true initially. We don't need to update the version if it's the same as what was already set.

		The third IF (runtimeVersion and it's not the default) handles the case where runtimeVersionSetting was undefined.
		We don't need to write the version to settings if it's the default. 
	*/
	if (newUpgradeSetting === true) {
		if (runtimeSetting && version.toLowerCase() !== runtimeSetting.toLowerCase()) {
			extension.shareMessageInMainOutputChannel(`Auto-upgrade setting enabled. Updating to default version ${version} of Apache Camel K CLI`);
			await config.setKamelRuntimeVersionConfig(version).then(() => {
				const msg = `Setting for Apache Camel K runtime version has changed to default ${version}. Please restart the workspace to refresh the Camel K cli.`;
				setVersionAndTellUser(msg, version);
			});
		}
	} else if (extension.runtimeVersionSetting) {
		if (runtimeSetting && runtimeSetting.trim().length > 0
			&& extension.runtimeVersionSetting.toLowerCase() !== runtimeSetting.toLowerCase()) {
			const msg = `Setting for Apache Camel K runtime version has changed to ${runtimeSetting}. Please restart the workspace to refresh the Camel K cli.`;
			setVersionAndTellUser(msg, runtimeSetting);
		}
	} else if (runtimeSetting && runtimeSetting.trim().length > 0 && version.toLowerCase() !== runtimeSetting.toLowerCase()) {
		const msg = `Setting for Apache Camel K runtime version has changed to ${runtimeSetting}. Please restart the workspace to refresh the Camel K cli.`;
		setVersionAndTellUser(msg, runtimeSetting);
	}
}

function setVersionAndTellUser(msg: string, newVersion: string) {
	extension.shareMessageInMainOutputChannel(msg);
	vscode.window.showWarningMessage(msg);
	extension.setRuntimeVersionSetting(newVersion);
}
