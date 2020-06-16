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
import * as vscode from 'vscode';

export function shareMessage(outputChannel: vscode.OutputChannel, msg:string): void {
	if (outputChannel) {
		if (!msg.endsWith('\n')) {
			msg = `${msg} \n`;
		}
		outputChannel.append(msg);
	} else {
		console.log('[' + msg + ']');
	}
}

export function toKebabCase (str : string) {
	return str.replace(/([A-Z])([A-Z])/g, '$1-$2')
		.replace(/([a-z])([A-Z])/g, '$1-$2')
		.replace(/[\s_]+/g, '-')
		.replace(/^[-]+/g, '')
		.replace(/[-]$/, '')
		.toLowerCase() ;
}
