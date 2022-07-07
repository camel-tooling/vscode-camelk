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

import { By, ExtensionsViewItem, Workbench, ViewContent, InputBox, BottomBarPanel, SideBarView, DefaultTreeItem, TextEditor } from 'vscode-extension-tester';

export let activationError = true;

export async function extensionIsActivated(extension: ExtensionsViewItem, timePeriod = 2000): Promise<boolean> {
    try {
        const activationTime = await extension.findElement(By.className('activationTime'));
        if (activationTime !== undefined) {
            activationError = false;
            return true;
        } else {
            await extension.getDriver().sleep(timePeriod);
            activationError = true;
            return false;
        }
    } catch (err) {
        await extension.getDriver().sleep(timePeriod);
        activationError = true;
        return false;
    }
}

export async function findSectionItem(section: string, item: string): Promise<DefaultTreeItem> {
    const content = new SideBarView().getContent();
    const currentSection = await content.getSection(section);
    await currentSection.expand();
    return await currentSection.findItem(item) as DefaultTreeItem;
}

export async function inputBoxQuickPickOrSet(type: "pick" | "set", indexOrText: string | number): Promise<boolean> {
    const input = await InputBox.create();
    if (type === "pick") {
        await input.selectQuickPick(indexOrText);
        return true;
    } else if (type === "set" && typeof indexOrText === "string") {
        await input.setText(indexOrText);
        await input.confirm();
        return true;
    } else {
        return false;
    }
}

export async function outputViewHasText(text: string, timePeriod = 2000): Promise<boolean> {
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

export async function viewHasItem(content: ViewContent, section: string, item: string, timePeriod = 2000): Promise<boolean> {
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

export async function updateFileText(oldText: string, newText: string, timePeriod = 2000): Promise<boolean> {
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
