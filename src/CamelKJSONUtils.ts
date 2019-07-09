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

export const proxyURLSetting = 'camelk.integrations.proxyURL';
export const proxyNamespaceSetting = 'camelk.integrations.proxyNamespace';

const camelAPIVersion = "v1alpha1";

export function createCamelKRestURL() : string {
	let server = vscode.workspace.getConfiguration().get(proxyURLSetting);
	let namespace = vscode.workspace.getConfiguration().get(proxyNamespaceSetting);
	let outputUrl = server + "/apis/camel.apache.org/" + camelAPIVersion + "/namespaces/" 
		+ namespace + "/integrations";
	return outputUrl;
}

export function createCamelKDeleteRestURL(integrationName:string) : string {
	let baseUrl = createCamelKRestURL();
	let outputUrl = baseUrl + "/" + integrationName;
	return outputUrl;
}

export function createCamelKPodLogURL(podName:string) : string {
	let server = vscode.workspace.getConfiguration().get(proxyURLSetting);
	let namespace = vscode.workspace.getConfiguration().get(proxyNamespaceSetting);
	let outputUrl = server + "/api/v1/namespaces/" + namespace + "/pods/" + podName + "/log";
	return outputUrl;
}

export function createCamelKGetPodsURL() : string {
	let server = vscode.workspace.getConfiguration().get(proxyURLSetting);
	let namespace = vscode.workspace.getConfiguration().get(proxyNamespaceSetting);
	let outputUrl = server + "/api/v1/namespaces/" + namespace + "/pods";
	return outputUrl;
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

export function shareMessage(outputChannel: vscode.OutputChannel, msg:string) {
	if (outputChannel) {
		outputChannel.append(msg + '\n\n');
	} else {
		console.log('[' + msg + ']');
	}
}
