import * as path from 'path';
import * as cp from 'child_process';

import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath, runTests } from 'vscode-test';

async function main() : Promise<void> {
	try {
		const extensionDevelopmentPath : string = path.resolve(__dirname, '../../../');
		console.log(`extensionDevelopmentPath = ${extensionDevelopmentPath}`);
        const extensionTestsPath : string = path.resolve(__dirname, './suite/index');
		console.log(`extensionTestsPath = ${extensionTestsPath}`);
		const vscodeExecutablePath : string = await downloadAndUnzipVSCode('stable');
		console.log(`vscodeExecutablePath = ${vscodeExecutablePath}`);
		const testWorkspace = path.resolve(__dirname, '../../../test Fixture with speci@l chars');

		const cliPath: string = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);
		installExtraExtension(cliPath, 'ms-kubernetes-tools.vscode-kubernetes-tools');
		installExtraExtension(cliPath, 'redhat.java');
		installExtraExtension(cliPath, 'redhat.vscode-commons');

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
