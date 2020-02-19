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
import * as vscode from 'vscode';
import { CamelKTaskCompletionItemProvider } from "../../task/CamelKTaskCompletionItemProvider";

suite("Camel K Task Completion", function () {

    let content = `{
        "version": "2.0.0",
        "tasks": [
            
        ]
    }`;

    test("no result outside of tasks", function (done) {
        expect(new CamelKTaskCompletionItemProvider().provideCompletionItemsForText(content, 2)).to.be.empty;
        done();
    });

    test("One completion in tasks array ", function (done) {
        let res = new CamelKTaskCompletionItemProvider().provideCompletionItemsForText(content, 49) as vscode.CompletionItem[];
        expect(res).to.have.lengthOf(1);
        done();
    });
});
