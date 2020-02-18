/**
 * 
 *   MIT License
 *
 *   Copyright (c) Microsoft Corporation. All rights reserved.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE
 */

// This code was originally part of the vscode-kubernetes-tools project. 
// No changes were made to the original code. 

import * as vscode from 'vscode';

export abstract class WebPanel {
	private disposables: vscode.Disposable[] = [];
	protected content: string;
	protected resource: string;
	private hasLivePanel = true;

	protected static createOrShowInternal<T extends WebPanel>(content: string, resource: string, viewType: string, title: string, currentPanels: Map<string, T>, fn: (p: vscode.WebviewPanel, content: string, resource: string) => T): T {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		// If we already have a panel, show it.
		const currentPanel = currentPanels.get(resource);
		if (currentPanel) {
			currentPanel.setInfo(content, resource);
			currentPanel.update();
			currentPanel.panel.reveal(column);
			return currentPanel;
		}
		const panel = vscode.window.createWebviewPanel(viewType, title, column || vscode.ViewColumn.One, {
			enableScripts: true,
			retainContextWhenHidden: true,

			// And restrict the webview to only loading content from our extension's `media` directory.
			localResourceRoots: [
			]
		});
		const result = fn(panel, content, resource);
		currentPanels.set(resource, result);
		return result;
	}

	protected constructor(
		protected readonly panel: vscode.WebviewPanel,
		content: string,
		resource: string,
		currentPanels: Map<string, WebPanel>
	) {
		this.content = content;
		this.resource = resource;

		this.update();
		this.panel.onDidDispose(() => this.dispose(currentPanels), null, this.disposables);

		this.panel.onDidChangeViewState(() => {
			if (this.panel.visible) {
				this.update();
			}
		}, null, this.disposables);
	}

	public setInfo(content: string, resource: string) {
		this.content = content;
		this.resource = resource;
		this.update();
	}

	protected dispose<T extends WebPanel>(currentPanels: Map<string, T>) {
		currentPanels.delete(this.resource);

		this.hasLivePanel = false;

		this.panel.dispose();

		while (this.disposables.length) {
			const x = this.disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	public get canProcessMessages(): boolean {
		return this.hasLivePanel;
	}

	protected abstract update(): void;
}
