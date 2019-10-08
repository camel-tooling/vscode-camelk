import * as path from 'path';
import * as cp from 'child_process';

import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath, runTests } from 'vscode-test';

async function main() : Promise<void> {
	try {
		const extensionDevelopmentPath : string = path.resolve(__dirname, '../../');
		console.log(`extensionDevelopmentPath = ${extensionDevelopmentPath}`);
        const extensionTestsPath : string = path.resolve(__dirname, './suite/index');
		console.log(`extensionTestsPath = ${extensionTestsPath}`);
		const vscodeExecutablePath : string = await downloadAndUnzipVSCode('stable');
		console.log(`vscodeExecutablePath = ${vscodeExecutablePath}`);

		const cliPath: string = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);
		cp.spawnSync(cliPath, ['--install-extension', 'ms-kubernetes-tools.vscode-kubernetes-tools'],
		{
			encoding: 'utf-8',
			stdio: 'inherit'
		});
		console.log(`Kubernetes VS Code extension installed`);
		
		await runTests({ vscodeExecutablePath, extensionDevelopmentPath, extensionTestsPath });

	} catch (err) {
		console.error('Failed to run tests' + err);
		process.exit(1);
	}
}

main();
