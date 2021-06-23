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

import { assert, expect } from 'chai';
import {
	By,
	ContextMenuItem,
	EditorView,
	until,
	ViewItem,
	ViewSection,
	WebView
} from 'vscode-extension-tester';
import {
	ActivityBar
} from 'vscode-uitests-tooling';

describe('Didact Tutorial of Camel K', function () {

	let switchedContextWebview: WebView | undefined;
	let handle: string | undefined;

	after(async function () {
		if (switchedContextWebview) {
			await switchBackWithAWorkaround();
			switchedContextWebview = undefined;
		}
		await new EditorView().closeAllEditors();
	});

	it('Check that Camel K Didact tutorial opens with some content', async function () {
		this.timeout(30000);
		await startTutorial();

		const didactTutorialWebView = new WebView();
		const expectedTitle = 'Apache Camel K';
		expect(await didactTutorialWebView.getTitle()).equal(expectedTitle);

		await checkContentOfTutorial(didactTutorialWebView, expectedTitle);
	});

	async function checkContentOfTutorial(didactTutorialWebView: WebView, expectedTitle: string) {
		await switchToFrameWithAWorkaround(didactTutorialWebView);
		switchedContextWebview = didactTutorialWebView;
		const titleElement = await didactTutorialWebView.findWebElement(By.css('h1'));
		expect(await titleElement.getText()).equal(expectedTitle);
	}

	/**
	 * See https://github.com/redhat-developer/vscode-extension-tester/issues/301
	 */
	async function switchToFrameWithAWorkaround(didactTutorialWebView: WebView) {
		handle = await didactTutorialWebView.getDriver().getWindowHandle();
		await didactTutorialWebView.getDriver().wait(until.elementLocated(By.className('webview ready')), 10000);
		const frame = await didactTutorialWebView.getDriver().findElement(By.className('webview ready'));
		await didactTutorialWebView.getDriver().switchTo().frame(frame);

		await didactTutorialWebView.getDriver().wait(until.elementLocated(By.id('active-frame')), 10000);
		const activeFrame = await didactTutorialWebView.getDriver().findElement(By.id('active-frame'));
		await didactTutorialWebView.getDriver().switchTo().frame(activeFrame);
	}

	/**
	 * See https://github.com/redhat-developer/vscode-extension-tester/issues/301
	 */
	async function switchBackWithAWorkaround() {
		if (switchedContextWebview !== undefined && handle !== undefined) {
			switchedContextWebview.getDriver().switchTo().window(handle);
		}
	}
});

async function startTutorial(): Promise<void> {
	const didactTutorialSectionView = await expandSectionViewInExplorerSideBar();
	await expandCategory(didactTutorialSectionView, 'Apache Camel K');
	const camelKTutorialItem = await didactTutorialSectionView.findItem('Your First Integration');
	assert.isNotNull(camelKTutorialItem, 'Missing "Your First Integration" entry inside "Apache Camel K" category');
	await (camelKTutorialItem as ViewItem).select();
	await new EditorView().closeAllEditors(); // to close Demonstrating Didact tutorial which opens during activation of Didact extension
	const contextMenu = await (camelKTutorialItem as ViewItem).openContextMenu();
	const startDidactTutorialContextMenu = await contextMenu.getItem('Start Didact tutorial');
	assert.isNotNull(startDidactTutorialContextMenu, '"Start Didact Tutorial" is nto part of contextual menu');
	await (startDidactTutorialContextMenu as ContextMenuItem).click();
	try {
		await new EditorView().getDriver().wait(async() => {
			return (await new EditorView().getOpenEditorTitles()).includes('Apache Camel K');
		});
	} catch(error) {
		throw new Error('No editor with title "Apache Camel K" found');
	}
}

async function expandCategory(didactTutorialSectionView: ViewSection, categoryCamelKDidact: string) {
	// next line is a workaround to https://github.com/redhat-developer/vscode-extension-tester/issues/303
	await didactTutorialSectionView.getDriver().wait(until.elementLocated(By.css('.monaco-list')), 10000);

	await didactTutorialSectionView.getDriver().wait(async () => {
		const viewItems: ViewItem[] = await didactTutorialSectionView?.getVisibleItems();
		for (const viewItem of viewItems) {
			if (await viewItem.getText() === categoryCamelKDidact) {
				return true;
			}
		}
		return false;
	}, 10000);
	await didactTutorialSectionView.openItem(categoryCamelKDidact);
}

async function expandSectionViewInExplorerSideBar(): Promise<ViewSection> {
	const explorerControl = await new ActivityBar().getViewControl('Explorer');
	const explorerView = await explorerControl.openView();
	assert.isNotNull(explorerView, 'Cannot open Explorer View');
	const didactTutorialSectionView = await explorerView.getContent().getSection('Didact Tutorials');
	assert.isNotNull(didactTutorialSectionView, 'No "Didact Tutorials" section retrieved.')
	await didactTutorialSectionView.expand();
	return didactTutorialSectionView;
}
