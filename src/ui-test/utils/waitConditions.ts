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

import * as consts from './uiTestConstants';
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
    OutputView,
    WebDriver,
    SideBarView
} from 'vscode-extension-tester';
import { DoNextTest, findSectionItem } from './utils';
import { workaroundMacIssue444 } from './workarounds';

export async function extensionIsActivated(extension: ExtensionsViewItem, activationError: DoNextTest): Promise<boolean> {
    try {
        const activationTime = await extension.findElement(By.className('activationTime'));
        if (activationTime !== undefined) {
            activationError.stopTest();
            return true;
        } else {
            activationError.continueTest();
            return false;
        }
    } catch (err) {
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

export async function viewHasItem(content: ViewContent, section: string, item: string): Promise<boolean> {
    try {
        const currentSection = await content.getSection(section);
        const currentItem = await currentSection.findItem(item);
        return (currentItem !== undefined);
    } catch (err) {
        return false;
    }
}

export async function updateFileText(oldText: string, newText: string): Promise<boolean> {
    const editor = new TextEditor();
    try {
        await editor.selectText(oldText);
        await editor.typeText(newText);
        await editor.save();
        return true;
    } catch (err) {
        return false;
    }
}

export async function contextMenuItemClick(parentItem: DefaultTreeItem, childItem: string): Promise<boolean> {
    try {
        if (process.platform === 'darwin') {
            await workaroundMacIssue444(parentItem, childItem);
            return true;
        } else { // Regular test 
            const menu = await parentItem.openContextMenu();
            const option = await menu.getItem(childItem);
            if (option && await option.isDisplayed() && await option.isEnabled()) {
                await option.click();
                return true;
            } else {
                return false;
            }
        }
    } catch (err) {
        return false;
    }
}

export async function cleanOutputView(): Promise<boolean> {
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
        return ((outputTextLength === 1 && process.platform !== 'win32') ||
            (outputTextLength === 2 && process.platform === 'win32'))
    } catch (err) {
        return false;
    }
}

export async function sidebarIntegrationRemove(driver: WebDriver, section: string, item: string): Promise<boolean> {
    const treeItem = await findSectionItem(section, item.toLowerCase());
    if (treeItem !== undefined) {
        await driver.wait(() => { return contextMenuItemClick(treeItem, consts.integrationRemove); });
        const content = new SideBarView().getContent();
        return await driver.wait(async () => {
            return !(await viewHasItem(content, section, item.toLowerCase()));
        });
    } else {
        return true;
    }
}

export async function webViewOpen(): Promise<WebView> {
    try {
        const webView = new WebView();
        if (await webView.isDisplayed() && await webView.isEnabled()) {
            return webView;
        } else {
            return await webViewOpen();
        }
    } catch (e) {
        return await webViewOpen();
    }
}

export async function webViewHasTextInWebElement(driver: WebDriver, text: string, locator: Locator = By.id('content'), timePeriod = 1000, timeout = 25000): Promise<boolean> {
    const webView = await driver.wait(async () => { return webViewOpen(); }, 5000);
    let lastContent = '';
    try {
        return await driver.wait(async () => {
            try {
                await webView.switchToFrame();
                const contentElement = await webView.findWebElement(locator);
                lastContent = await contentElement.getText();
                await webView.switchBack();
                if (lastContent.indexOf(text) > -1) {
                    return true;
                } else {
                    webView.getDriver().sleep(timePeriod);
                    return false;
                }
            } catch (err) {
                await webView.switchBack();
                webView.getDriver().sleep(timePeriod);
                return false;
            }
        }, timeout);
    } catch (e) {
        console.log(`Last content retrieved from webView: ${lastContent}`);
        await webView.switchBack();
        webView.getDriver().sleep(timePeriod);
        return false;
    }
}
