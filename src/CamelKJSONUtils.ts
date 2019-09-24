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
import * as kamel from './kamel';

export const proxyURLSetting = 'camelk.integrations.proxyURL';
export const proxyNamespaceSetting = 'camelk.integrations.proxyNamespace';
export const proxyPortSetting = 'camelk.integrations.proxyPort';

const camelAPIVersion = "v1alpha1";

export function createBaseProxyURL() : string {
	let server:string = vscode.workspace.getConfiguration().get(proxyURLSetting) as string;
	let port:number = vscode.workspace.getConfiguration().get(proxyPortSetting) as number;
	return `${server}:${port}`;
}

export function createCamelKRestURL() : string {
	let base: string = createBaseProxyURL();
	let namespace: string = vscode.workspace.getConfiguration().get(proxyNamespaceSetting) as string;
	return `${base}/apis/camel.apache.org/${camelAPIVersion}/namespaces/${namespace}/integrations`;
}

export function createCamelKDeleteRestURL(integrationName:string) : string {
	let baseUrl: string = createCamelKRestURL();
	let outputUrl: string = baseUrl + "/" + integrationName;
	return outputUrl;
}

export function createCamelKPodLogURL(podName:string) : string {
	let base: string = createCamelKGetPodsURL();
	return `${base}${podName}/log`;
}

export function createCamelKGetPodsURL() : string {
	let base: string = createBaseProxyURL();
	let namespace: string = vscode.workspace.getConfiguration().get(proxyNamespaceSetting) as string;
	return `${base}/api/v1/namespaces/${namespace}/pods/`;
}

export function stringifyFileContents(absoluteFilePath:string) : Promise<string> {
	return new Promise( (resolve, reject) => {
		var text = fs.readFileSync(absoluteFilePath);
		if (text) {
			resolve(text.toString());
		} else {
			reject(new Error(`Unable to read content of ${absoluteFilePath}.`));
		}
	});
}

export function createCamelKDeployJSON( name:string, fileContent:string, fileName:string) : Promise<string> {
	return new Promise( (resolve, reject) => {
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
		try {
			let jsonText: string = JSON.stringify(content);
			resolve(jsonText);
		} catch ( error ) {
			reject(error);
		}
	});
}

export function delay (amount : number) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, amount);
	});
}

export function pingTheURL(urlString: string) : Promise<boolean> {
	return new Promise<boolean>( (resolve, reject) => {
		http.get(urlString, ( result ) => {
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

export function pingKubernetes() : Promise<string> {
	return new Promise<string> ( (resolve, reject) => {
		let proxyURL = createCamelKRestURL();
		return pingTheURL(proxyURL)
			.then ( (result) => {
				if (result) {
					resolve(proxyURL);
				} else {
					throw new Error("Kubernetes proxy inaccessible");
				}
			})
			.catch( (error) => {
				reject(error);
			});
	});
}

export function pingKamel() : Promise<string> {
	return new Promise<string>( async (resolve, reject) => {
		let kamelExe = kamel.create();
		await kamelExe.invoke('get')
			.then( () => {
				resolve('found it');
				return;
			})
			.catch( (error) => {
				reject(new Error(`Apache Camel K CLI unavailable: ${error}`));
				return;
			});
	});
}

export function shareMessage(outputChannel: vscode.OutputChannel, msg:string): void {
	if (outputChannel) {
		if (!msg.endsWith('\n')) {
			msg = `${msg} \n`;
		}
		outputChannel.append(msg);
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
