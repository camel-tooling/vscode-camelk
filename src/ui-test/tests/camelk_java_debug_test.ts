/**
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License", destination); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'

import * as pjson from '../../../package.json';
import {
	ActivityBar,
	CustomTreeSection,
	EditorView,
	InputBox,
	SideBarView,
	TextEditor,
	ViewItem,
	VSBrowser,
	Workbench
} from 'vscode-extension-tester';
import { Marketplace } from 'vscode-uitests-tooling';
import { DoNextTest, prepareEmptyTestFolder } from '../utils/utils';
import { extensionIsActivated, sectionHasItem } from '../utils/waitConditions';
import * as uiTestConstants from '../utils/uiTestConstants';

const START_DEBUG_LABEL = uiTestConstants.startDebug;
const REMOVE_INTEGRATION_LABEL = uiTestConstants.integrationRemove;

export function camelKJavaDebugTest(extensionActivated: DoNextTest) {

	describe('Test Debug on Camel K Integrations from Side Bar', function () {

		before(async function () {
			this.timeout(90000);
			this.retries(3);
			await VSBrowser.instance.waitForWorkbench();
			await prepareEmptyTestFolder(uiTestConstants.testDir);
			await VSBrowser.instance.openResources(uiTestConstants.testDir);
			await VSBrowser.instance.driver.wait(camelKToolingIsEnabled);
		});

		describe('Java Debug', function () {
			
			const INTEGRATION_LABEL = 'java-debug-test';
			const INTEGRATION_FILE = 'JavaDebugTest';

			before(async function (){
				this.timeout(60000);
				await moveToExplorerActivity();
				await createIntegration(INTEGRATION_FILE);
				await startIntegration(INTEGRATION_LABEL);
			})

			it('Check Java Debug available', async function () {
				this.timeout(20000);

				const item = await getIntegration(INTEGRATION_LABEL);
				await VSBrowser.instance.driver.wait(async() => 
					{
						const menu = await item.openContextMenu();
						const hasMenu = await menu.hasItem(START_DEBUG_LABEL);
						await menu.close();
						return hasMenu;
					}, 5000);
			});

			after(async function() {
				this.timeout(20000);
				await removeIntegration(INTEGRATION_LABEL);
				await prepareEmptyTestFolder(uiTestConstants.testDir);
			});

		});

		describe('No Java Debug on Invalid Files', function() {

			const INTEGRATION_LABEL = 'java-debug-test-invalid';
			const INTEGRATION_FILE = 'JavaDebugTestInvalid';

			before(async function (){
				this.timeout(60000);
				await moveToExplorerActivity();
				await createIntegration(INTEGRATION_FILE);
				await modifyCurrentFileToBeInvalid();
				await startIntegration(INTEGRATION_LABEL);
			});

			it('Test Java Debugger Not Available On Invalid File', async function() {
				this.timeout(20000)
				const item = await getIntegration(INTEGRATION_LABEL);
				await VSBrowser.instance.driver.wait(async() => 
					{
						const menu = await item.openContextMenu();
						const hasMenu = await menu.hasItem(START_DEBUG_LABEL);
						await menu.close();
						return !hasMenu;
					}, 5000);
			});

			after(async function() {
				this.timeout(20000);
				await removeIntegration(INTEGRATION_LABEL);
				await prepareEmptyTestFolder(uiTestConstants.testDir);
			});
		})

	});

	async function camelKToolingIsEnabled() {
		const marketplace = await Marketplace.open();
		const item = await marketplace.findExtension(`@installed ${pjson.displayName}`);
		return extensionIsActivated(item, extensionActivated);
	}

	async function moveToExplorerActivity() {
		const ACTIVITY_LABEL = 'Explorer';

		return moveToActivity(ACTIVITY_LABEL);
	}

	async function moveToActivity(viewIdentifier: string) {
		const control = await new ActivityBar().getViewControl(viewIdentifier);
		return VSBrowser.instance.driver.wait(async () => control?.openView());
	}

	async function getCamelKIntegrationSection() {
		const section = await new SideBarView().getContent().getSection(uiTestConstants.extensionName) as CustomTreeSection;
		await section.expand();
		await VSBrowser.instance.driver.wait(async () => section.isExpanded());
		return section;
	}

	async function getIntegration(integrationLabel: string) {
		const section = await getCamelKIntegrationSection();
		await VSBrowser.instance.driver.wait(async () => hasIntegration(integrationLabel));
		return await section.findItem(integrationLabel) as ViewItem;
	}

	async function hasIntegration(integrationLabel: string) {
		const section = await getCamelKIntegrationSection();
		return await sectionHasItem(section, integrationLabel);
	}

	async function createIntegration(integrationFile: string) {
		const workbench = new Workbench();
		await workbench.executeCommand(uiTestConstants.createNewIntegrationFile);
		const languageInput = await InputBox.create();
		await languageInput.selectQuickPick('Java');
		const WORKSPACE_FOLDERInput = await InputBox.create();
		await WORKSPACE_FOLDERInput.selectQuickPick(0);
		const nameInput = await InputBox.create();
		await nameInput.setText(integrationFile);
		await nameInput.confirm();

		const editorView = new EditorView();
		await VSBrowser.instance.driver.wait(async() => {
			try {
				return await editorView.openEditor(integrationFile + '.java') !== undefined;
			} catch {
				return false;
			}
		});
		return workbench;
	}

	async function startIntegration(integrationLabel: string) {
		const workbench = new Workbench();
		await workbench.executeCommand(uiTestConstants.startIntegration);
		const startMode = await InputBox.create();
		await startMode.selectQuickPick('Basic');

		await VSBrowser.instance.driver.wait(async () => hasIntegration(integrationLabel));
	}

	async function removeIntegration(integrationLabel: string) {
		const item = await getIntegration(integrationLabel);
		const menu = await item.openContextMenu();
		const removeItem = await menu.getItem(REMOVE_INTEGRATION_LABEL);
		await removeItem?.click();
	}

	async function modifyCurrentFileToBeInvalid() {
		const textEditor : TextEditor = new TextEditor();
		await textEditor.setTextAtLine(14, ";");
		await textEditor.save()
	}
}