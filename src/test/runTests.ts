import * as path from 'path';
import * as cp from 'child_process';

import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';
import * as os from 'os';

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
		installExtraExtension(cliPath, 'ms-kubernetes-tools.vscode-kubernetes-tools', args);
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
	cp.spawnSync(cliPath, [...args, '--install-extension', extensionId, '--force'], {
		encoding: 'utf-8',
		stdio: 'inherit',
		shell: os.platform() === 'win32' // to workaround https://github.com/nodejs/node/issues/52554#issuecomment-2060026269
	});
	console.log(`A message of type "Extension '${extensionId}' vx.y.z was successfully installed." must be written few lines above if installation really worked.`);
}

main();
