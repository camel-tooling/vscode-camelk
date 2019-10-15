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
import * as k8s from 'vscode-kubernetes-tools-api';

export function isKubernetesAvailable(): Promise<boolean> {
	return new Promise<boolean>( (resolve) => {
		k8s.extension.kubectl.v1
			.then( (kubectl) => {
				resolve(kubectl && kubectl.available);
			})
			.catch( err => {
				resolve(false);
			});
	});
}

export function getNamedListFromKubernetes(itemType : string, extra? : string): Promise<string> {
	return new Promise<string>( async (resolve, reject) => {
		await k8s.extension.kubectl.v1
			.then( async (kubectl) => {
				let cmd = `get ${itemType}`;
				if (extra) {
					cmd += ` ${extra}`;
				}
				if (kubectl && kubectl.available) {
					return await kubectl.api.invokeCommand(cmd);
				} else {
					reject(new Error('Kubernetes not available'));
				}
			})
			.then( (result) => {
				if (!result || result.code !== 0) {
					let error = `Unable to invoke kubectl to retrieve ${itemType}`;
					if (result && result.stderr) {
						error = result.stderr;
					}  
					reject(error);
				} else if (result) {
					const splitResults = result.stdout;
					resolve(splitResults);
				}
			})
			.catch( (err) => reject(err) );
	});
}

export function getNamedListFromKubernetesThenParseList(itemType : string): Promise<string[]> {
	return new Promise<string[]>( (resolve, reject) => {
		getNamedListFromKubernetes(itemType)
			.then ((result) => {
				const itemList : string[] = parseShellResult(result);
				resolve(itemList);
				return;
			}).catch( (error) => {
				reject(error);
				return;
			});
	});
}

export function parseShellResult(output: string) : string[] {
	let processedList : string[] = [''];
	if (output) {
		let lines = output.split('\n');
		for (let entry of lines) {
			let line = entry.split('  ');
			let cleanLine = [];
			for (var i=0; i < line.length; i++) {
				if (line[i].trim().length === 0) {
					continue;
				}
				cleanLine.push(line[i].trim());
			}
			let firstString : string = cleanLine[0];
			if (firstString === undefined || firstString.toUpperCase().startsWith('NAME') || firstString.trim().length === 0) {
				continue;
			}

			let itemName = cleanLine[0];
			processedList.push(itemName);
		}
	}
	return processedList;
}

export function getConfigMaps(): Promise<string[]> {
	return getNamedListFromKubernetesThenParseList('configmap');
}

export function getSecrets(): Promise<string[]> {
	return getNamedListFromKubernetesThenParseList('secret');
}

export function getIntegrations(): Promise<string> {
	return getNamedListFromKubernetes('integration');
}

export function getPodsFromKubectlCli() : Promise<string> {
	return new Promise<string>( async (resolve, reject) => {
		await k8s.extension.kubectl.v1
			.then( async (kubectl) => {
				let cmd = `get pods`;
				if (kubectl && kubectl.available) {
					return await kubectl.api.invokeCommand(cmd);
				} else {
					reject(new Error('Kubernetes not available'));
				}
			})
			.then( (result) => {
				if (!result || result.code !== 0) {
					let error = `Unable to invoke kubectl to retrieve pod information`;
					if (result && result.stderr) {
						error = result.stderr;
					}  
					reject(error);
				} else if (result) {
					const splitResults = result.stdout;
					resolve(splitResults);
				}
			})
			.catch( (err) => reject(err) );
	});
}

export async function getKubernetesVersion(): Promise<string | undefined> {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        return '';
    }

    const kubectlPromise = await kubectl.api.invokeCommand(`version --output json`);
    let sr : any= null;
    if (kubectlPromise) {
        sr = kubectlPromise as k8s.KubectlV1.ShellResult;
    }
    if (!sr || sr.code !== 0) {
        return undefined;
    }

    const versionInfo = JSON.parse(sr.stdout);
    const serverVersion = versionInfo.serverVersion;
    if (!serverVersion) {
        return '';
    }

    const major = serverVersion.major;
	const minor = serverVersion.minor;
    if (!major || !minor) {
        return '';
    }

    return `${major}.${minor}`;
}
