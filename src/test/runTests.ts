import * as path from 'path';
import * as cp from 'child_process';

import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath, runTests } from 'vscode-test';

async function main() : Promise<void> {
	try {
		const extensionDevelopmentPath : string = path.resolve(__dirname, '../../../');
		console.log(`extensionDevelopmentPath = ${extensionDevelopmentPath}`);
        const extensionTestsPath : string = path.resolve(__dirname, './suite/index');
		console.log(`extensionTestsPath = ${extensionTestsPath}`);
		let vscodeExecutablePath : string;
		const vscodeVersionForTest = process.env.VSCODE_VERSION_TEST;
		if(vscodeVersionForTest !== undefined){
			vscodeExecutablePath = await downloadAndUnzipVSCode(vscodeVersionForTest);
		} else {
			// FIXME: using previous version to workaround https://github.com/microsoft/vscode/issues/126636
			vscodeExecutablePath = await downloadAndUnzipVSCode('1.57.1');
		}
		console.log(`vscodeExecutablePath = ${vscodeExecutablePath}`);
		const testWorkspace = path.resolve(__dirname, '../../../test Fixture with speci@l chars');

		const cliPath: string = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);
		installExtraExtension(cliPath, 'ms-kubernetes-tools.vscode-kubernetes-tools');
		installExtraExtension(cliPath, 'redhat.java');
		installExtraExtension(cliPath, 'vscjava.vscode-java-debug');

		await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath, launchArgs: [testWorkspace] });

	} catch (err) {
		console.error('Failed to run tests' + err);
		process.exit(1);
	}
}

function installExtraExtension(cliPath: string, extensionId: string) {
	cp.spawnSync(cliPath, ['--install-extension', extensionId, '--force'], {
		encoding: 'utf-8',
		stdio: 'inherit'
	});
	console.log(`VS Code extension ${extensionId} installed`);
}

main();
