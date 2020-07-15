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
import * as config from './config';

export async function isKubernetesAvailable(): Promise<boolean> {
	const kubectl: k8s.API<k8s.KubectlV1> = await k8s.extension.kubectl.v1;
	return kubectl && kubectl.available;
}

export async function getNamedListFromKubernetes(itemType : string, extra? : string): Promise<string> {
	const kubectl: k8s.API<k8s.KubectlV1> = await k8s.extension.kubectl.v1;
	let cmd = `get ${itemType}`;
	if (extra) {
		cmd += ` ${extra}`;
	}
	if (kubectl && kubectl.available) {
		const result: k8s.KubectlV1.ShellResult | undefined = await kubectl.api.invokeCommand(cmd);
		if (!result || result.code !== 0) {
			let error = `Unable to invoke kubectl to retrieve ${itemType}`;
			if (result && result.stderr) {
				error = result.stderr;
			}  
			return Promise.reject(error);
		} else if (result) {
			return result.stdout;
		}
	}
	return Promise.reject('kubectl not available');
}

export async function getNamedListFromKubernetesThenParseList(itemType : string, extra? : string): Promise<string[]> {
	try {
		const result = await getNamedListFromKubernetes(itemType, extra);
		return parseShellResult(result);
	} catch (error) {
		return Promise.reject(error);
	}
}

export function parseShellResult(output: string) : string[] {
	const processedList : string[] = [''];
	if (output) {
		let lines: string[] = output.split('\n');
		for (const entry of lines) {
			const line: string[] = entry.split('  ');
			const cleanLine = [];
			for (var i=0; i < line.length; i++) {
				if (line[i].trim().length === 0) {
					continue;
				}
				cleanLine.push(line[i].trim());
			}
			const firstString : string = cleanLine[0];
			if (firstString === undefined || firstString.toUpperCase().startsWith('NAME') || firstString.trim().length === 0) {
				continue;
			}

			const itemName = cleanLine[0];
			processedList.push(itemName);
		}
	}
	return processedList;
}

export async function getConfigMaps(): Promise<string[]> {
	const namespace: string | undefined = config.getNamespaceconfig();
	if (namespace) {
		return await getNamedListFromKubernetesThenParseList('configmap', `--namespace=${namespace}`);
	} else {
		return await getNamedListFromKubernetesThenParseList('configmap');
	}
}

export async function getSecrets(): Promise<string[]> {
	const namespace: string | undefined = config.getNamespaceconfig();
	if (namespace) {
		return await getNamedListFromKubernetesThenParseList('secret', `--namespace=${namespace}`);
	} else {
		return await getNamedListFromKubernetesThenParseList('secret');
	}
}

export async function getIntegrations(): Promise<string> {
	const namespace: string | undefined = config.getNamespaceconfig();
	if (namespace) {
		return await getNamedListFromKubernetes('integration', `--namespace=${namespace}`);
	} else {
		return await getNamedListFromKubernetes('integration');
	}
}

export async function getPodsFromKubectlCli() : Promise<string> {
	const kubectl: k8s.API<k8s.KubectlV1> = await k8s.extension.kubectl.v1;
	const cmd: string = `get pods`;
	if (kubectl && kubectl.available) {
		const result: k8s.KubectlV1.ShellResult | undefined = await kubectl.api.invokeCommand(cmd);
		if (!result || result.code !== 0) {
			let error: string = `Unable to invoke kubectl to retrieve pod information`;
			if (result && result.stderr) {
				error = result.stderr;
			}
			return Promise.reject(error);
		} else if (result) {
			return result.stdout;
		}
	}
	return Promise.reject('kubectl not available');
}

export async function getKubernetesVersion(): Promise<string | undefined> {
	const kubectl: k8s.API<k8s.KubectlV1> = await k8s.extension.kubectl.v1;
	if (!kubectl || !kubectl.available) {
		return '';
	}

	const result: k8s.KubectlV1.ShellResult | undefined = await kubectl.api.invokeCommand('version --client --output json');
	if (!result || result.code !== 0) {
		return undefined;
	}

	const versionInfo = JSON.parse(result.stdout);
	if (!versionInfo || !versionInfo.clientVersion) {
		return '';
	}

	const major = versionInfo.clientVersion.major;
	const minor = versionInfo.clientVersion.minor;
	if (!major || !minor) {
		return '';
	}

	return `${major}.${minor}`;
}

export async function getNamedPodsFromKubectl(podNameRoot : string): Promise<string[]> {
	let outArray : string[] = [];
	try {
		const allPods: string = await getPodsFromKubectlCli();
		let podArray = parseShellResult(allPods);
		for (const podName of podArray) {
			if (podName.startsWith(podNameRoot)) {
				outArray.push(podName);
			}
		}
	} catch (error) {
		console.error(error);
		return Promise.reject(error);
	}
	return outArray;
}