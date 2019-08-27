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
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as http from "http";
import * as child_process from 'child_process';

export const proxyURLSetting = 'camelk.integrations.proxyURL';
export const proxyNamespaceSetting = 'camelk.integrations.proxyNamespace';
export const proxyPortSetting = 'camelk.integrations.proxyPort';

const camelAPIVersion = "v1alpha1";

export function createBaseProxyURL() : string {
	let server = vscode.workspace.getConfiguration().get(proxyURLSetting);
	let port = vscode.workspace.getConfiguration().get(proxyPortSetting) as number;
	return `${server}:${port}`;
}

export function createCamelKRestURL() : string {
	let base = createBaseProxyURL();
	let namespace = vscode.workspace.getConfiguration().get(proxyNamespaceSetting);
	return `${base}/apis/camel.apache.org/${camelAPIVersion}/namespaces/${namespace}/integrations`;
}

export function createCamelKDeleteRestURL(integrationName:string) : string {
	let baseUrl = createCamelKRestURL();
	let outputUrl = baseUrl + "/" + integrationName;
	return outputUrl;
}

export function createCamelKPodLogURL(podName:string) : string {
	let base = createCamelKGetPodsURL();
	return `${base}${podName}/log`;
}

export function createCamelKGetPodsURL() : string {
	let base = createBaseProxyURL();
	let namespace = vscode.workspace.getConfiguration().get(proxyNamespaceSetting);
	return `${base}/api/v1/namespaces/${namespace}/pods/`;
}

export function stringifyFileContents(absoluteFilePath:string) : Promise<string> {
	return new Promise( (resolve, reject) => {
		var text = fs.readFileSync(absoluteFilePath);
		if (text) {
			let textStr = text.toString();
			resolve(textStr);
		} else {
			reject();
		}
	});
}

export function createCamelKDeployJSON( name:string, fileContent:string, fileName:string) : Promise<string> {
	return new Promise( (resolve) => {
		let content = {
			"kind":"Integration",
			"apiVersion":"camel.apache.org/" + camelAPIVersion,
			"metadata": {
				"name" : name.toLowerCase()
			},
			"spec" : {
				"sources" : [
					{
						"content" : fileContent,
						"name" : fileName
					}
				]
			}
		};
		let jsonText = JSON.stringify(content);
		resolve(jsonText);
	});
}

export async function delay (amount : number) {
	return new Promise((resolve) => {
	  setTimeout(resolve, amount);
	});
}

export async function pingTheURL(urlString: string) : Promise<any> {
	return new Promise( (resolve, reject) => {
		http.get(urlString, (result) => {
			if (result && result.statusCode === 200) { 
				resolve(true);
			} else { 
				reject(result.statusCode); 
			}
		}).on('error', (e) => {
			reject(e); 
		});
	});
}

export async function pingKubernetes() : Promise<string> {
	let proxyURL = createCamelKRestURL();
	return new Promise<string> ( async (resolve, reject) => {
		await pingTheURL(proxyURL).then ( (result) => { 
			if (result === true) {
				resolve(proxyURL);
			}
			throw new Error("Kubernetes proxy inaccessible");
		}).catch( (error) => {
			reject(new Error("Kubernetes proxy inaccessible: " + error));
		});
	});
}

export async function pingKamel() : Promise<any> {
	return new Promise( async (resolve, reject) => {
		const pingKamelCommand = "kamel get";
		let runKubectl = child_process.exec(pingKamelCommand);
		if (runKubectl.stdout) {
			runKubectl.stdout.on('data', function (data) {
				let output : string = data as string;
				resolve(output);
				return;
			});
		}
		if (runKubectl.stderr) {
			runKubectl.stderr.on('data', function (data) {
				let error : string = data as string;
				reject(new Error(error));
				return;
			});
		}
	}); 
}

export function shareMessage(outputChannel: vscode.OutputChannel, msg:string) {
	if (outputChannel) {
		outputChannel.show();
		outputChannel.append(msg + '\n');
	} else {
		console.log('[' + msg + ']');
	}
}

export function toKebabCase (str : string) {
	return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replace(/[\s_]+/g, '-')
		.replace(/^[-]+/g, '')
		.replace(/[-]$/, '')
		.toLowerCase() ;
}
