import * as path from 'path';
import * as fs from 'fs';
import mkdirp = require('mkdirp');
import {platform} from 'os';
import { Errorable } from './errorable';
import { Shell } from './shell';
import * as child_process from 'child_process';
import * as extension from './extension';
import * as config from './config';
import * as kamelCli from './kamel';

const download = require('download-tarball');

export const kamel = 'kamel';
export const kamel_windows = 'kamel.exe';

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

export function checkKubectlCLIVersion() : Promise<string> {
	return new Promise<string>( (resolve, reject) => {
        checkIfCLIAvailable('kubectl version')
            .then( (rtnValue) => {
                const strArray = rtnValue.split(' ');
                strArray.forEach(element => {
                    if (element.toLowerCase().startsWith('gitversion')) {
                        const version = element.substring(element.indexOf('\"') + 1, element.lastIndexOf('\"'));
                        console.log(`Kubernetes CLI (kubectl) version returned: ${version}`);
                        resolve(version);
                        return;
                    }
                });
                reject (new Error('No kubectl version found'));
                return;
            }).catch ( (error) => {
                console.log(`Kubernetes CLI (kubectl)  unavailable: ${error}`);
				reject(new Error(error));
				return;
        });
    });
}

export function checkMinikubeCLIVersion() : Promise<string> {
	return new Promise<string>( (resolve, reject) => {
        checkIfCLIAvailable('minikube version')
            .then( (rtnValue) => {
                const strArray = rtnValue.split(' ');
                const version = strArray[strArray.length - 1].trim();
                console.log(`Minikube CLI (minikube) version returned: ${version}`);
                resolve(version);
                return;
            }).catch ( (error) => {
                console.log(`Minikube CLI (minikube)  unavailable: ${error}`);
				reject(new Error(error));
				return;
        });
    });
}

async function checkIfCLIAvailable(command : string) : Promise<string>{
	return new Promise<string>( (resolve, reject) => {
		let runCommand = child_process.exec(command);
		if (runCommand.stdout) {
			runCommand.stdout.on('data', function (data) {
				let output : string = data as string;
				resolve(output);
				return;
			});
		}
		if (runCommand.stderr) {
			runCommand.stderr.on('data', function (data) {
				let error : string = data as string;
				reject(new Error(error));
				return;
			});
		}
	});
}

export async function installKamel(shell: Shell): Promise<Errorable<null>> {

    const version = '1.0.0-M1'; //need to retrieve this if possible, but have a default
    await checkKamelCLIVersion().then((currentVersion) => {
        const currentVersionString = currentVersion as string;
        if (version.toLowerCase() === currentVersionString.toLowerCase()) {
            // no need to install, it's already here
            extension.shareMessageInMainOutputChannel(`Apache Camel K CLI version ${currentVersionString} available`);
            return { succeeded: true, result: null };
        }
    }).catch ( (error) => {
        console.error(error);
    });

    const os = platform();
    const isWindows = (os === 'win32');
    const binFile = (!isWindows) ? kamel : kamel_windows;

    const installFolder = getInstallFolder(shell, kamel);
    mkdirp.sync(installFolder);

    const kamelUrl = `https://github.com/apache/camel-k/releases/download/${version}/camel-k-client-${version}-${os}-64bit.tar.gz`;
    const downloadFile = path.join(installFolder, binFile);

    extension.shareMessageInMainOutputChannel(`Downloading kamel cli tool from ${kamelUrl} to ${downloadFile}`);

    grabTarGzAndUnGZ(kamelUrl, installFolder).then( (flag) => {
        console.log(`Downloaded ${downloadFile} successfully: ${flag}`);
        try {
            if (fs.existsSync(downloadFile)) {
                if (shell.isUnix()) {
                    fs.chmodSync(downloadFile, '0777');
                }
                config.addKamelPathToConfig(downloadFile);
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

function getInstallFolder(shell: Shell, tool: string): string {
    return path.join(shell.home(), `.vs-camelk/tools/${tool}`);
}

async function grabTarGzAndUnGZ(fileUrl: string, directory: string) : Promise<boolean>{
	return new Promise<boolean>( (resolve, reject) => {
        download({
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
