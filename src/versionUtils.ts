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
import { platformString } from './installer';
import fetch from 'cross-fetch';

export const version: string = '1.1.0'; //need to retrieve this if possible, but have a default

/*
* Can be retrieved using `curl -i https://api.github.com/repos/apache/camel-k/releases/latest` and searching for "last-modified" attribute
* To be updated when updating the default "version" attribute
*/
const LAST_MODIFIED_DATE_OF_DEFAULT_VERSION: string = 'Monday, 27 Jul 2020 19:27:00 GMT';
let latestVersionFromOnline: string;

export async function testVersionAvailable(versionToUse: string): Promise<boolean> {
	if (platformString && versionToUse) {
		try {
			const kamelUrl : string = await getDownloadURLForCamelKTag(versionToUse, platformString);
			return await pingGithubUrl(kamelUrl);
		} catch (error) {
			// ignore
		}
	}
	return false;
}

export async function checkKamelNeedsUpdate(versionToUse?: string): Promise<boolean> {
	const runtimeVersionSetting = vscode.workspace.getConfiguration().get(config.RUNTIME_VERSION_KEY) as string;
	if (versionToUse) {
		const passedVersionAvailable = await testVersionAvailable(versionToUse);
		if (!passedVersionAvailable) {
			const msg: string = `Camel K CLI Version ${versionToUse} unavailable.`;
			extension.shareMessageInMainOutputChannel(msg);
			return false;
		}
	} else if (!versionToUse) {
		const latestversion = await getLatestCamelKVersion();
		if (failed(latestversion)) {
			console.error(latestversion.error);
			return true;
		}
		versionToUse = latestversion.result.trim();
	}

	if (runtimeVersionSetting && runtimeVersionSetting.toLowerCase() !== versionToUse.toLowerCase()) {
		const runtimeVersionAvailable = await testVersionAvailable(runtimeVersionSetting);
		if (!runtimeVersionAvailable) {
			versionToUse = version;
		} else {
			versionToUse = runtimeVersionSetting;
		}
	}

	if (versionToUse) {
		const currentVersion: string | void = await checkKamelCLIVersion();
		if (currentVersion) {
			return versionToUse.toLowerCase() !== currentVersion.toLowerCase();
		} else {
			return true;
		}		
	}
	return false;
}

export async function pingGithubUrl(urlStr: string): Promise<boolean> {
	// placeholder to ensure that this url path is accessible
	console.log(`Validate that ${urlStr} is accessible`);
	try {
		const res = await fetch(urlStr);
		return res !==undefined && res.status === 200;
	} catch (err) {
		console.error(err);
	}
	return false;
}

export function isOldTagNaming(tagName: string): boolean {
	return tagName.startsWith('0.') || tagName.startsWith('1.0.');
}

export async function getLatestCamelKVersion(): Promise<Errorable<string>> {
	if (latestVersionFromOnline) {
		return { succeeded: true, result: latestVersionFromOnline };
	} else {
		const latestURL: string = 'https://api.github.com/repos/apache/camel-k/releases/latest';
		const headers: string[][] = [['If-Modified-Since', LAST_MODIFIED_DATE_OF_DEFAULT_VERSION]];
		const githubToken: string | undefined = process.env.VSCODE_CAMELK_GITHUB_TOKEN;
		if (githubToken) {
			headers.push(['Authorization', `token ${githubToken}`]);
		}
		const res: Response = await fetch(latestURL, { headers: headers });
		if (res.status === 200) {
			const latestJSON: any = await res.json();
			const tagName: any = latestJSON.tag_name;
			if (tagName) {
				if (isOldTagNaming(tagName)) {
					// older tags without leading 'v'
					latestVersionFromOnline = tagName;
				} else {
					// newer tags with leading 'v'
					latestVersionFromOnline = tagName.substring(1);
				}
				return { succeeded: true, result: latestVersionFromOnline };
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

async function checkKamelCLIVersion(): Promise<string | void> {
	try { 
		const kamelLocal: kamelCli.Kamel = kamelCli.create();
		const rtnValue: string | void = await kamelLocal.invoke('version');
		const strArray: string[] = rtnValue.split(' ');
		const detectedVersion: string = strArray[strArray.length - 1].trim();
		console.log(`Apache Camel K CLI (kamel) version returned: ${detectedVersion}`);
		return detectedVersion;
	} catch (error) {
		console.error(error);
	}	
}

export async function handleChangeRuntimeConfiguration() {
	const runtimeSetting: string | undefined = config.getKamelRuntimeVersionConfig();
	const newUpgradeSetting: boolean = config.getKamelAutoupgradeConfig();

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
			await config.setKamelRuntimeVersionConfig(version);
			const msg: string = `Setting for Apache Camel K runtime version has changed to default ${version}. Please restart the workspace to refresh the Camel K cli.`;
			setVersionAndTellUser(msg, version);
		}
	} else if (extension.runtimeVersionSetting) {
		if (runtimeSetting && runtimeSetting.trim().length > 0 && extension.runtimeVersionSetting.toLowerCase() !== runtimeSetting.toLowerCase()) {
			let isAvailable : boolean = await testVersionAvailable(runtimeSetting);
			if (isAvailable) {
				const msg: string = `Setting for Apache Camel K runtime version has changed to ${runtimeSetting}. Please restart the workspace to refresh the Camel K cli.`;
				setVersionAndTellUser(msg, runtimeSetting);
			} else {
				const msg: string = `Setting for Apache Camel K runtime version changed to invalid version ${runtimeSetting}. Please set the version to a valid runtime version.`;
				extension.shareMessageInMainOutputChannel(msg);
				vscode.window.showErrorMessage(msg);
			}
		}
	} else if (runtimeSetting && runtimeSetting.trim().length > 0 && version.toLowerCase() !== runtimeSetting.toLowerCase()) {
		const msg: string = `Setting for Apache Camel K runtime version has changed to ${runtimeSetting}. Please restart the workspace to refresh the Camel K cli.`;
		setVersionAndTellUser(msg, runtimeSetting);
	}
}

function setVersionAndTellUser(msg: string, newVersion: string) {
	extension.shareMessageInMainOutputChannel(msg);
	vscode.window.showWarningMessage(msg);
	extension.setRuntimeVersionSetting(newVersion);
}

export async function getDownloadURLForCamelKTag(camelKVersion : string, platformStr : string): Promise<string> {
	let tagName: string = isOldTagNaming(camelKVersion) ? camelKVersion : `v${camelKVersion}`;
	const tagURL: string = `https://api.github.com/repos/apache/camel-k/releases/tags/${tagName}`;
	const headers: string[][] = [];
	const githubToken: string | undefined = process.env.VSCODE_CAMELK_GITHUB_TOKEN;
	if (githubToken) {
		headers.push(['Authorization', `token ${githubToken}`]);
	}
	const res: Response = await timeout(9000, fetch(tagURL, { headers: headers }));
	if (res.status === 200) {
		const latestJSON: any = await res.json();
		const assetsJSON: any = await latestJSON.assets;
		for (let asset of assetsJSON) {
			const aUrl : string = asset.browser_download_url;
			if (aUrl.includes(`-${platformStr}-`)) {
				return aUrl;
			}
		}
		return Promise.reject(`Failed to retrieve latest Apache Camel K version tag from: ${tagURL}`);
	} else {
		return Promise.reject(`Failed to find Camel K tag ${tagName} at github: ${res.status} ${res.statusText}`);
	}
}

/**
 * Timeout function
 * @param {Integer} time (miliseconds)
 * @param {Promise} promise
 */
async function timeout(time: number, promise: Promise<any>): Promise<any> {
	return new Promise<any>( (resolve, reject) => {
		setTimeout( () => {
			reject(new Error('Request timed out.'));
		}, time);
		promise.then(resolve, reject);
	});
} 
