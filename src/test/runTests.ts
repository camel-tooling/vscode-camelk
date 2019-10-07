import * as path from 'path';
import * as cp from 'child_process';

const { downloadAndUnzipVSCode, runTests } = require('vscode-test');

export function resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath: string) {
	if (process.platform === 'win32') {
		if (vscodeExecutablePath.endsWith('Code - Insiders.exe')) {
			return path.resolve(vscodeExecutablePath, '../bin/code-insiders.cmd');
		} else {
			return path.resolve(vscodeExecutablePath, '../bin/code.cmd');
		}
	} else if (process.platform === 'darwin') {
		return path.resolve(vscodeExecutablePath, '../../../Contents/Resources/app/bin/code');
	} else if (process.platform === 'linux') {
		if (vscodeExecutablePath.endsWith('code-insiders')) {
			return path.resolve(vscodeExecutablePath, '../code-insiders');
		} else {
			return path.resolve(vscodeExecutablePath, '../code');
		}
	} else {
		if (vscodeExecutablePath.endsWith('code-insiders')) {
			return path.resolve(vscodeExecutablePath, '../bin/code-insiders');
		} else {
			return path.resolve(vscodeExecutablePath, '../bin/code');
		}
	}
}

async function doTheThing(vscodePath : string ) : Promise<string> {
	return new Promise<string>( async (resolve, reject) => {
		/**
		 * Install Kubernetes extension
		 */
        const extensionId : string = 'ms-kubernetes-tools.vscode-kubernetes-tools';
		const cliPath : string = resolveCliPathFromVSCodeExecutablePath(vscodePath);
		console.log(`cliPath = ${cliPath}`);
		const spawnMe = cp.spawn(cliPath, ['--install-extension', '--force', extensionId]);
		if (spawnMe.stderr) {
			spawnMe.stderr.on('data', function (data) {
				console.log(`Error ${data}`);
				reject(data);
				return;
			});
		}
		resolve(cliPath);
		return;
	});
}

async function go() : Promise<void> {
	try {
		const version = '1.36.1'; // 'stable'
		const extensionDevelopmentPath : string = path.resolve(__dirname, '../../');
		console.log(`extensionDevelopmentPath = ${extensionDevelopmentPath}`);
        const extensionTestsPath : string = path.resolve(__dirname, './suite/index');
		console.log(`extensionTestsPath = ${extensionTestsPath}`);
		const vscodeExecutablePath : string = await downloadAndUnzipVSCode(version);
		console.log(`vscodeExecutablePath = ${vscodeExecutablePath}`);

		/**
		 * Install Kubernetes extension
		 */
		const cliPath : any = doTheThing(vscodeExecutablePath);
		if (cliPath) {
			console.log(`Kubernetes VS Code extension installed`);
			await runTests({ vscodeExecutablePath, version, extensionDevelopmentPath, extensionTestsPath });
		}
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

go();
