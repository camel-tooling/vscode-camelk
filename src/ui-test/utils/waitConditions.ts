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
'use strict';

import {
    By,
    ExtensionsViewItem,
    Workbench,
    ViewContent,
    BottomBarPanel,
    DefaultTreeItem,
    TextEditor,
    WebView,
    Locator,
    OutputView
} from 'vscode-extension-tester';
import { DoNextTest } from './utils';
import { workaroundMacIssue444 } from './workarounds';

export async function extensionIsActivated(extension: ExtensionsViewItem, activationError: DoNextTest, timePeriod = 1000): Promise<boolean> {
    try {
        const activationTime = await extension.findElement(By.className('activationTime'));
        if (activationTime !== undefined) {
            activationError.stopTest();
            return true;
        } else {
            await extension.getDriver().sleep(timePeriod);
            activationError.continueTest();
            return false;
        }
    } catch (err) {
        await extension.getDriver().sleep(timePeriod);
        activationError.continueTest();
        return false;
    }
}

export async function outputViewHasText(text: string, timePeriod = 1000): Promise<boolean> {
    const outputView = await new BottomBarPanel().openOutputView();
    try {
        await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
        const currentText = await outputView.getText();
        if (currentText.indexOf(text) > -1) {
            return true;
        } else {
            await outputView.getDriver().sleep(timePeriod);
            return false;
        }
    } catch (err) {
        await outputView.getDriver().sleep(timePeriod);
        return false;
    }
}

export async function viewHasItem(content: ViewContent, section: string, item: string, timePeriod = 1000): Promise<boolean> {
    try {
        const currentSection = await content.getSection(section);
        const currentItem = await currentSection.findItem(item);
        if (currentItem !== undefined) {
            return true;
        } else {
            await currentSection.getDriver().sleep(timePeriod);
            return false;
        }
    } catch (err) {
        await content.getDriver().sleep(timePeriod);
        return false;
    }
}

export async function updateFileText(oldText: string, newText: string, timePeriod = 1000): Promise<boolean> {
    const editor = new TextEditor();
    try {
        await editor.selectText(oldText);
        await editor.typeText(newText);
        await editor.save();
        return true;
    } catch (err) {
        await editor.getDriver().sleep(timePeriod);
        return false;
    }
}

export async function webViewHasTextInWebElement(text: string, locator: Locator = { id: 'content' }, timePeriod = 1000): Promise<boolean> {
    let webView = new WebView();
    try {
        if (await webView.isDisplayed() && await webView.isEnabled()) {
            await webView.switchToFrame();
            const contentElement = await webView.findWebElement(locator);
            const content = await contentElement.getText();
            if (content.indexOf(text) > -1) {
                await webView.switchBack();
                return true;
            } else {
                await webView.switchBack();
                await webView.getDriver().sleep(timePeriod);
                return false;
            }
        } else {
            await webView.getDriver().sleep(timePeriod);
            webView = new WebView();
            return false;
        }
    } catch (err) {
        await webView.switchBack();
        await webView.getDriver().sleep(timePeriod);
        return false;
    }
}

export async function contextMenuItemClick(parentItem: DefaultTreeItem, childItem: string, timePeriod = 1000): Promise<boolean> {
    const webView = new WebView();
    try {
        if (process.platform === 'darwin') {
            await workaroundMacIssue444(parentItem, childItem);
            return true;
        } else { // Regular test 
            const menu = await parentItem.openContextMenu();
            const option = await menu.getItem(childItem);
            if (option) {
                await option.click();
                return true;
            } else {
                await webView.getDriver().sleep(timePeriod);
                return false;
            }
        }
    } catch (err) {
        await webView.getDriver().sleep(timePeriod);
        return false;
    }
}

export async function cleanOutputView(timePeriod = 1000): Promise<boolean> {
    let outputView: OutputView;
    if (await new BottomBarPanel().isDisplayed()) {
        outputView = await new BottomBarPanel().openOutputView();
    } else {
        return true;
    }
    try {
        await (await new Workbench().openNotificationsCenter()).clearAllNotifications();
        await outputView.clearText();
        const outputTextLength = (await outputView.getText()).length;
        if ((outputTextLength === 1 && process.platform !== 'win32') ||
            (outputTextLength === 2 && process.platform === 'win32')) {
            return true;
        }
        await outputView.getDriver().sleep(timePeriod);
        return false;
    } catch (err) {
        await outputView.getDriver().sleep(timePeriod);
        return false;
    }
}
