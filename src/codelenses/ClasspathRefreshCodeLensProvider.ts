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
import * as vscode from 'vscode';
import * as extension from '../extension';

const CAMELK_MODELINE_PREFIX = '// camel-k:';

const CODELENS_TITLE_REFRESH_CLASSPATH = 'Refresh classpath dependencies';

export class ClasspathRefreshCodeLensProvider implements vscode.CodeLensProvider {
	
	onDidChangeCodeLenses?: vscode.Event<void>;
	
	provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
		const fulltext = document.getText();
		if(fulltext.includes(CAMELK_MODELINE_PREFIX)) {
			const topOfDocument = new vscode.Range(0, 0, 0, 0);
			const classPathRefreshCommand: vscode.Command = {
				command: extension.COMMAND_ID_CLASSPATH_REFRESH,
				title: CODELENS_TITLE_REFRESH_CLASSPATH,
				arguments: [document.uri]
			};
			return [new vscode.CodeLens(topOfDocument, classPathRefreshCommand)];
		}
		return [];
	}
	
}
