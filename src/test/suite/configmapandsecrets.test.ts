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

import * as configmapandsecrets from '../../ConfigMapAndSecrets';
import {parseShellResult} from '../../kubectlutils';
import * as assert from 'assert';

suite("ensure utility methods in configmap and secrets code works as expected", function() {
	
	function runSetOfNames(inputs: string[], expectedResult : boolean) {
		for (let i = 0; i < inputs.length; i++) {
			let testString = inputs[i];
			let result = configmapandsecrets.validNameRegex.test(testString);
			assert.strictEqual(result, expectedResult, 
				`Testing name ${testString}. Should be ${expectedResult}. Came back as ${result}`);
		}
	}

	test("validate name regex working as expected for valid names", function(done) {
		const validNames : string[] = [
			'ab',
			'a-b',
			'a1b',
			'a1'
		];
		runSetOfNames(validNames, true);
		done();
	});

	test("validate name regex working as expected for invalid names", function(done) {
		const invalidNames : string[] = [
			' a',
			'a b',
			'1a',
			'a '
		];
		runSetOfNames(invalidNames, false);
		done();
	});

	test("make sure the console parser works as expected to retrieve list of named items", function(done) {
		const data = 
			"NAME                     DATA   AGE\n" + 
			"something                1      90m\n" +
			"something-else           1      92m";
		const expectedResult : string[] = ['', 'something','something-else'];
		let result : string[] = parseShellResult(data);
		assert.deepEqual(result, expectedResult, `Did not get expected list of names from console shell results`);
		done();
	});
});
