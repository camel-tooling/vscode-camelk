/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as assert from 'assert';
import * as child_process from 'child_process';

// note that if the sanitize.go changes, we will need to update the tests in CamelKJSONUtils.ts
// and we will need to re-stash the sanitize.go file from github
// it was last stashed on 23-JUL-2019
// to restash, go to the src/test directory and run
// > curl -o sanitize.go https://raw.githubusercontent.com/apache/camel-k/master/pkg/util/kubernetes/sanitize.go
// then rename the file to "sanitize.go.saved"

// this is not the best solution, but it offers a way to ensure that if things change upstream at least we know when the tests fail

suite("ensure that the upstream kubernetes.go sanitize in camel-k have not changed since we checked last", function() {

	var fileName : string = 'sanitize.go';
	var url = 'https://raw.githubusercontent.com/apache/camel-k/master/pkg/util/kubernetes/sanitize.go';
	
	test("test to see if the sanitize.go file has changed since we stashed it", function(done) {
		var goPath = retrieveSanitizeFileFromUpstream(fileName, url);
		let stashedFile = path.join(__dirname, '../../../src/test/suite/sanitize.go.saved');

		var str1 = fs.readFileSync(goPath, 'utf-8');
		var str2 = fs.readFileSync(stashedFile, 'utf-8');
		str2 = replaceCarriageReturns(str1);

		assert.equal(fs.existsSync(goPath), true);
		assert.strictEqual(str1, str2);
		done();
	});
});

var replaceCarriageReturns = function(str:string) {
	var regxp = /\r\n/g;
	str = str.replace(regxp, " ");
	return str;
}

function retrieveSanitizeFileFromUpstream(fileName: string, url: string) {
	var goPath = path.join(fs.realpathSync(os.tmpdir()), fileName);
	let commandString = `curl -o ${fileName} -L ${url}`;
	console.log(goPath);
	console.log(commandString);
	child_process.execSync(commandString, { cwd: os.tmpdir() });
	return goPath;
}

