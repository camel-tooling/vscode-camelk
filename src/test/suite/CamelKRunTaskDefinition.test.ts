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

import { CamelKRunTaskDefinition, CamelKRunTaskProvider } from "../../task/CamelKRunTaskDefinition";
import { ShellExecution } from "vscode";
import { assert } from "chai";

suite("Camel K Run Task definition", function() {

    test("ensure include configmap", async() => {
        let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "configmap": "aDummyConfigMapId",
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--config=configmap:aDummyConfigMapId');
    });

    test("ensure include compression flag", async() => {
		let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "compression": true,
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--compression');
    });

    test("ensure include dependencies", async() => {
		let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "dependencies": ["camel.mina2", "mvn:com.google.guava:guava:26.0-jre"],
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--dependency=camel.mina2');
        assert.include(execution.commandLine, '--dependency=mvn:com.google.guava:guava:26.0-jre');
    });

    test("ensure include dev flag", async() => {
		let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "dev": true,
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--dev');
    });

    test("ensure include Environment variables", async() => {
		let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "environmentVariables": ["MY_ENV=value", "MY_ENV2=value2"],
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '-e MY_ENV=value');
        assert.include(execution.commandLine, '-e MY_ENV2=value2');
    });

    test("ensure include target file", async() => {
		let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, 'dummyFileValue.xml');
    });

    test("ensure include profile", async() => {
		let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "profile": "adummyprofile",
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--profile=adummyprofile');
    });

    test("ensure include properties", async() => {
        let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "properties": ["prop1=value1", "prop2=value2"],
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '-p prop1=value1');
        assert.include(execution.commandLine, '-p prop2=value2');
    });

    test("ensure include resources", async() => {
		let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "resources": ["adummyresource1.txt", "adummyresource2.txt"],
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--resource=file:adummyresource1.txt');
        assert.include(execution.commandLine, '--resource=file:adummyresource2.txt');
    });

    test("ensure include secret", async() => {
		let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "secret": "adummysecret",
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '--config=secret:adummysecret');
    });
    
    test("ensure include traits", async() => {
        let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "traits": ["camel.enabled=true", "camel.runtime-version=3.0.0"],
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '-t camel.enabled=true');
        assert.include(execution.commandLine, '-t camel.runtime-version=3.0.0');
    });
    
    test("ensure include volumes", async() => {
        let def: CamelKRunTaskDefinition = {
            "file" : "dummyFileValue.xml",
            "volumes": ["pvcname:/container/path", "pvcname:/container/path2"],
            "type": CamelKRunTaskProvider.START_CAMELK_TYPE
        };
        const task = await new CamelKRunTaskProvider().getRunTask(def);
        let execution = task.execution as ShellExecution;
        assert.include(execution.commandLine, '-v pvcname:/container/path');
        assert.include(execution.commandLine, '-v pvcname:/container/path2');
    });
});
