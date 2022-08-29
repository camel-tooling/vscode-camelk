import * as path from 'path';
import * as cp from 'child_process';

import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';

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
			vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
		}
		console.log(`vscodeExecutablePath = ${vscodeExecutablePath}`);
		const testWorkspace = path.resolve(__dirname, '../../../test Fixture with speci@l chars');

		const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
		installExtraExtension(cliPath, 'ms-kubernetes-tools.vscode-kubernetes-tools', args);
		installExtraExtension(cliPath, 'redhat.java', args);
		installExtraExtension(cliPath, 'vscjava.vscode-java-debug', args);

		await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath, launchArgs: [testWorkspace, '--disable-workspace-trust'] });

	} catch (err) {
		console.error('Failed to run tests' + err);
		process.exit(1);
	}
}

function installExtraExtension(cliPath: string, extensionId: string, args: string[]) {
	cp.spawnSync(cliPath, [...args, '--install-extension', extensionId, '--force'], {
		encoding: 'utf-8',
		stdio: 'inherit'
	});
	console.log(`VS Code extension ${extensionId} installed`);
}

main();
