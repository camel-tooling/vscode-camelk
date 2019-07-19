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

suite("ensure that the upstream kubernetes.go sanitize in camel-k have not changed since we checked last", async function() {

	var dest : string = 'sanitize.go';
	var url = 'https://raw.githubusercontent.com/apache/camel-k/master/pkg/util/kubernetes/sanitize.go';
	var goPath = path.join(os.tmpdir(), dest);

	test("test that we can get the sanitize.go file from the camel-k git repository", async function() {

		let commandString = `curl -o -L ${dest} ${url}`;
		console.log(commandString);

		let runKamel = child_process.exec(commandString, { cwd: os.tmpdir() });
		runKamel.stderr.on('data', function (data) {
			assert.fail('Failed to curl file to local download ' + data);
		});
		assert.ok('Got file');
	});

	test("test to see if the sanitize.go file has changed since we stashed it", async function() {
		let stashedFile = path.join(__dirname, '../../src/test/sanitize.go.saved');

		var str1 = fs.readFileSync(goPath, 'utf-8');
		var str2 = fs.readFileSync(stashedFile, 'utf-8');

		assert.equal(str1 === str2, true);
	});

	test("see if we can call the sanitize.go functions -- skipped", async function() {
		// answer is NO -- the node-ffi component does not compile with this version of node for some reason
		// attempted to use this approach - https://medium.com/learning-the-go-programming-language/calling-go-functions-from-other-languages-4c7d8bcc69bf

		// var ref = require("ref");
		// var ffi = require("ffi");
		// var stringPtr = ref.refType('string');
		// var awesome = ffi.Library(goPath, {
		// 	SanitizeName: [stringPtr, [stringPtr]]
		// });
		// assert.equal(awesome.SanitizeName("./abc.java"), "abc");
		assert.ok("We cannot use Node-FFI to test the Go functions");
	});

});
