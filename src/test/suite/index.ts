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

//import * as fs from 'fs';
import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';
//import { TestRunnerOptions, CoverageRunner } from './../coverage';

// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implement the method statically
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tty = require('tty');
if (!tty.getWindowSize) {
	tty.getWindowSize = (): number[] => {
		return [80, 75];
	};
}

// function loadCoverageRunner(testsRoot: string): CoverageRunner | undefined {
// 	let coverageRunner: CoverageRunner;
// 	const coverConfigPath = path.join(testsRoot, '..', '..', '..', 'coverconfig.json');
// 	if (!process.env.VST_DISABLE_COVERAGE && fs.existsSync(coverConfigPath)) {
// 		coverageRunner = new CoverageRunner(JSON.parse(fs.readFileSync(coverConfigPath, 'utf-8')) as TestRunnerOptions, testsRoot);
// 		//coverageRunner.setupCoverage();
// 		return coverageRunner;
// 	}
// }

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
	//const coverageRunner = loadCoverageRunner(testsRoot);

	return new Promise((c, e) => {
		glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
			if (err) {
				return e(err);
			}

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
				})/*.on('end', () => coverageRunner && coverageRunner.reportCoverage())*/;
			} catch (innererr) {
				e(innererr);
			}
		});
	});
}
