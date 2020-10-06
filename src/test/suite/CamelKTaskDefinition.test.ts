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

import { CamelKTaskDefinition, CamelKTaskProvider } from "../../task/CamelKTaskDefinition";
import { ShellExecution } from "vscode";
import { assert } from "chai";

suite("Camel K Task definition", function() {

    test("ensure include configmap", async() => {
        let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "configmap": "aDummyConfigMapId",
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--configmap=aDummyConfigMapId');
    });

    test("ensure include compression flag", async() => {
		let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "compression": true,
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--compression');
    });

    test("ensure include dependencies", async() => {
		let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "dependencies": ["camel.mina2", "mvn:com.google.guava:guava:26.0-jre"],
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--dependency=camel.mina2');
        assert.include(execution.commandLine, '--dependency=mvn:com.google.guava:guava:26.0-jre');
    });

    test("ensure include dev flag", async() => {
		let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "dev": true,
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--dev');
    });

    test("ensure include Environment variables", async() => {
		let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "environmentVariables": ["MY_ENV=value", "MY_ENV2=value2"],
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '-e MY_ENV=value');
        assert.include(execution.commandLine, '-e MY_ENV2=value2');
    });

    test("ensure include target file", async() => {
		let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, 'dummyFileValue.xml');
    });

    test("ensure include profile", async() => {
		let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "profile": "adummyprofile",
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--profile=adummyprofile');
    });

    test("ensure include properties", async() => {
        let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "properties": ["prop1=value1", "prop2=value2"],
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '-p prop1=value1');
        assert.include(execution.commandLine, '-p prop2=value2');
    });

    test("ensure include resource", async() => {
		let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "resource": "adummyresource",
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--resource="adummyresource"');
    });

    test("ensure include secret", async() => {
		let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "secret": "adummysecret",
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--secret=adummysecret');
    });
    
    test("ensure include traits", async() => {
        let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "traits": ["camel.enabled=true", "camel.runtime-version=3.0.0"],
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '-t camel.enabled=true');
        assert.include(execution.commandLine, '-t camel.runtime-version=3.0.0');
    });
    
    test("ensure include volumes", async() => {
        let def: CamelKTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "volumes": ["pvcname:/container/path", "pvcname:/container/path2"],
            "type": CamelKTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKTaskProvider().getTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '-v pvcname:/container/path');
        assert.include(execution.commandLine, '-v pvcname:/container/path2');
    });
});
