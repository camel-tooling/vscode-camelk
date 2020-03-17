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

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as IntegrationUtils from './../../IntegrationUtils';
import { getDocUri } from './completion.util';

suite("IntegrationUtil tests", function() {

    let sandbox: sinon.SinonSandbox;
    let showQuickPickStub: sinon.SinonStub;
    let executeTaskStub: sinon.SinonStub;
    
    setup(() => {
		sandbox = sinon.createSandbox();
        showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
        executeTaskStub = sandbox.stub(vscode.tasks, 'executeTask');
	});	

	teardown(() => {
        showQuickPickStub.restore();
        executeTaskStub.restore();
		sandbox.reset();
	});

    test("ensure listing Camel K task when accessing 'Start Apache Camel Integration'", async function() {
        showQuickPickStub.onFirstCall().returns(IntegrationUtils.vscodeTasksIntegration);
        showQuickPickStub.onSecondCall().returns('Test Camel K task');
        
        await IntegrationUtils.startIntegration(getDocUri('MyRouteBuilder.java'));
        
        sinon.assert.calledWith(showQuickPickStub,
            ['Start in dev mode Camel K integration opened in active editor', 'Test Camel K task'],
            {placeHolder: 'Choose a predefined task'});
        sinon.assert.calledOnce(executeTaskStub);
    });

    test("ensure filtering out Camel K task with unrelated target file when accessing 'Start Apache Camel Integration'", async function() {
        showQuickPickStub.onFirstCall().returns(IntegrationUtils.vscodeTasksIntegration);
        showQuickPickStub.onSecondCall().returns(undefined);
        
        await IntegrationUtils.startIntegration(getDocUri('UnRelated.java'));

        sinon.assert.calledWith(showQuickPickStub,
            ['Start in dev mode Camel K integration opened in active editor'],
            {placeHolder: 'Choose a predefined task'});
        sinon.assert.notCalled(executeTaskStub);
    });
    
});
