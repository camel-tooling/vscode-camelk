//
// PLEASE DO NOT MODIFY / DELETE UNLESS YOU KNOW WHAT YOU ARE DOING
//
// This file is providing the test runner to use when running extension tests.
// By default the test runner in use is Mocha based.
//
// You can provide your own test runner if you want to override it by exporting
// a function run(testRoot: string, clb: (error:Error) => void) that the extension
// host can call to run the tests. The test runner is expected to use console.log
// to report the results back to the caller. When the tests are finished, return
// a possible error to the callback or null if none.

import * as path from 'path';
import * as Mocha from 'mocha';
import { globSync } from 'glob';

// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implement the method statically
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tty = require('tty');
if (!tty.getWindowSize) {
	tty.getWindowSize = (): number[] => {
		return [80, 75];
	};
}

// Create the mocha test
const mocha = new Mocha({
	ui: 'tdd',
	timeout: 40000,
	reporter: 'mocha-jenkins-reporter',
	color: true
});

export function run(): Promise<void> {
	const testsRoot = path.resolve(__dirname, '..');
	console.log(`testsRoot = ${testsRoot}`);

	return new Promise((c, e) => {
		const files = globSync('**/**.test.js', { cwd: testsRoot });

		// Add files to the test suite
		files.forEach(f => {
			mocha.addFile(path.resolve(testsRoot, f));
		});

		try {
			// Run the mocha test
			mocha.run(failures => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c();
				}
			});
		} catch (innererr) {
			e(innererr);
		}
	});
}
