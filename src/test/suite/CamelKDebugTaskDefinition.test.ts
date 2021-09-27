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

import { CamelKDebugTaskDefinition, CamelKDebugTaskProvider } from "../../task/CamelKDebugTaskDefinition";
import { ShellExecution } from "vscode";
import { assert } from "chai";

suite("Camel K Debug Task definition", function() {

    test("basic case", async() => {
        const def: CamelKDebugTaskDefinition = {
            "integrationName": "demo",
            "type": CamelKDebugTaskProvider.DEBUG_CAMELK_TYPE
        };
        const task = await new CamelKDebugTaskProvider().getDebugTask(def);
        const execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, 'debug demo');
    });
	
	test("with port parmater", async() => {
        const def: CamelKDebugTaskDefinition = {
            "integrationName": "demo",
			"port": 3000,
            "type": CamelKDebugTaskProvider.DEBUG_CAMELK_TYPE
        };
        const task = await new CamelKDebugTaskProvider().getDebugTask(def);
        const execution = task.execution as ShellExecution;
		assert.include(execution.commandLine, 'kamel" debug demo');
        assert.include(execution.commandLine, ' --port 3000');
    });
	
	test("with remote port parameter", async() => {
        const def: CamelKDebugTaskDefinition = {
            "integrationName": "demo",
			"remotePort": 4000,
            "type": CamelKDebugTaskProvider.DEBUG_CAMELK_TYPE
        };
        const task = await new CamelKDebugTaskProvider().getDebugTask(def);
        const execution = task.execution as ShellExecution;
		assert.include(execution.commandLine, 'kamel" debug demo');
        assert.include(execution.commandLine, ' --remote-port 4000');
    });
	
	test("with suspend parameter", async() => {
        const def: CamelKDebugTaskDefinition = {
            "integrationName": "demo",
			"suspend": false,
            "type": CamelKDebugTaskProvider.DEBUG_CAMELK_TYPE
        };
        const task = await new CamelKDebugTaskProvider().getDebugTask(def);
        const execution = task.execution as ShellExecution;
		assert.include(execution.commandLine, 'kamel" debug demo');
        assert.include(execution.commandLine, ' --suspend false');
    });

});
