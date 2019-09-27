import * as k8s from 'vscode-kubernetes-tools-api';
import * as kubectl from './kubectl';

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
		let kubectlExe = kubectl.create();
		let kubectlArgs : string[] = [];
		kubectlArgs.push('get');
		kubectlArgs.push(`pods`);

		await kubectlExe.invokeArgs(kubectlArgs)
			.then( (runKubectl) => {
				var shellOutput = '';
				if (runKubectl.stdout) {
					runKubectl.stdout.on('data', function (data) {
						shellOutput += data;
					});
				}
				if (runKubectl.stderr) {
					runKubectl.stderr.on('data', function (data) {
						reject(data);
						return;
					});
				}
				runKubectl.on("close", () => {
					resolve(shellOutput);
					return;
				});
			})
			.catch( (error) => {
				reject(new Error(`Kubernetes CLI unavailable: ${error}`));
				return;
			});
	});
}
