import * as path from 'path';
import * as cp from 'child_process';

import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
	try {
		const extensionDevelopmentPath: string = path.resolve(__dirname, '../../../');
		console.log(`extensionDevelopmentPath = ${extensionDevelopmentPath}`);
		const extensionTestsPath: string = path.resolve(__dirname, './suite/index');
		console.log(`extensionTestsPath = ${extensionTestsPath}`);
		const testWorkspace = path.resolve(__dirname, '../../../test Fixture with speci@l chars');
		console.log(`testWorkspace = ${testWorkspace}`);

		const vscodeVersion = computeVSCodeVersionToPlayTestWith();
		console.log(`vscodeVersion = ${vscodeVersion}`);

		const vscodeExecutablePath: string = await downloadAndUnzipVSCode(vscodeVersion);
		console.log(`vscodeExecutablePath = ${vscodeExecutablePath}`);

		const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
		installExtraExtension(cliPath, 'ms-kubernetes-tools.vscode-kubernetes-tools@1.3.15', args);
		installExtraExtension(cliPath, 'redhat.java', args);
		installExtraExtension(cliPath, 'redhat.vscode-apache-camel', args);
		installExtraExtension(cliPath, 'vscjava.vscode-java-debug', args);

		await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath, launchArgs: [testWorkspace, '--disable-workspace-trust'] });

	} catch (err) {
		console.error('Failed to run tests: ' + err);
		process.exit(1);
	}

	function computeVSCodeVersionToPlayTestWith() {
		const envVersion = process.env.CODE_VERSION;
		if (envVersion === undefined || envVersion === 'max') {
			return 'stable';
		} else if (envVersion === 'latest') {
			return 'insiders';
		}
		return envVersion;
	}

}

function installExtraExtension(cliPath: string, extensionId: string, args: string[]) {
	const spawnOutput = cp.spawnSync(cliPath, [...args, '--install-extension', extensionId, '--force'], {
		encoding: 'utf-8',
		stdio: 'inherit'
	});
	console.log('output: '+spawnOutput.output);
	console.log('stderr: '+spawnOutput.stderr);
	console.log('error: '+ spawnOutput.error);
	console.log(`VS Code extension ${extensionId} installed`);
}

main();
