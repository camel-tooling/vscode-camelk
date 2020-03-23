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

import { expect } from 'chai';
import { CamelKTaskCompletionItemProvider } from "../../task/CamelKTaskCompletionItemProvider";
import * as Utils from './Utils';
import * as vscode from 'vscode';

suite("Camel K Task Completion", function () {

    let simpleContent = `{
        "version": "2.0.0",
        "tasks": [
            
        ]
    }`;

    test("no result outside of tasks", async () => {
        expect(await new CamelKTaskCompletionItemProvider().provideCompletionItemsForText(simpleContent, 2)).to.be.empty;
    });

    test("One completion in tasks array", async () => {
        let res = await new CamelKTaskCompletionItemProvider().provideCompletionItemsForText(simpleContent, 49);
        expect(res).to.have.lengthOf(1);
    });

    test("Completion for traits", async () => {
        await Utils.ensureExtensionActivated();
        let contentWithEmptyTrait =
`{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Config with traits",
            "type": "camel-k",
            "dev": true,
            "file": "dummy",
            "problemMatcher": [],
            "traits": []
        }
    ]
}`;
		const res = await new CamelKTaskCompletionItemProvider().provideCompletionItemsForText(contentWithEmptyTrait, 236);
		expect(res).to.have.lengthOf(26);
		const affinityCompletionItem = res.find(item => item.label === 'affinity');
		const affinitySnippet = affinityCompletionItem?.insertText as vscode.SnippetString;
		expect(affinitySnippet.value).equals('"affinity.${1|enabled,pod-affinity,pod-anti-affinity,node-affinity-labels,pod-affinity-labels,pod-anti-affinity-labels|}="');
    }).timeout(120000);

});
