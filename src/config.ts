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
import {platform} from 'os';
import {version} from './versionUtils';

export const EXTENSION_CONFIG_KEY = "camelk.tools";
export const KAMEL_PATH_CONFIG_KEY = "camelk.tools.kamel-path";
export const KUBERNETES_EXTENSION_CONFIG_KEY = "vs-kubernetes";
export const KUBECTL_PATH_CONFIG_KEY = "vs-kubernetes.kubectl-path";
export const NAMESPACE_KEY = "camelk.namespace";
export const SHOW_STATUS_BAR_KEY = "camelk.integrations.showStatusBarMessages";
export const REMOVE_LOGVIEW_ON_SHUTDOWN_KEY = "camelk.integrations.closeLogViewWhenIntegrationRemoved";
export const RUNTIME_VERSION_KEY = "camelk.integrations.runtimeVersion";
export const AUTOUPGRADE_KEY = "camelk.integrations.autoUpgrade";

export async function addKamelPathToConfig(value: string) : Promise<void> {
	await setConfigValue(KAMEL_PATH_CONFIG_KEY, value);
}

export async function addKubectlPathToConfig(value: string) : Promise<void> {
	await setConfigValueForRoot(KUBERNETES_EXTENSION_CONFIG_KEY, KUBECTL_PATH_CONFIG_KEY, value);
}

export async function addPathToConfig(configKey: string, value: string): Promise<void> {
	await setConfigValue(configKey, value);
}

async function setConfigValue(configKey: string, value: any): Promise<void> {
	await atAllConfigScopes(addValueToConfigAtScope, configKey, value);
}

async function setConfigValueForRoot(rootKey : string, configKey: string, value: any): Promise<void> {
	await atAllConfigScopesWithRoot(addValueToConfigAtScopeForRoot, rootKey, configKey, value);
}

async function addValueToConfigAtScope(configKey: string, value: any, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean): Promise<void> {
	if (!createIfNotExist) {
		if (!valueAtScope || !(valueAtScope[configKey])) {
			return;
		}
	}

	let newValue: any = {};
	if (valueAtScope) {
		newValue = Object.assign({}, valueAtScope);
	}
	newValue[configKey] = value;
	await vscode.workspace.getConfiguration().update(EXTENSION_CONFIG_KEY, newValue, scope);
}

async function addValueToConfigAtScopeForRoot(rootKey : string, configKey: string, value: any, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean): Promise<void> {
	if (!createIfNotExist) {
		if (!valueAtScope || !(valueAtScope[configKey])) {
			return;
		}
	}

	let newValue: any = {};
	if (valueAtScope) {
		newValue = Object.assign({}, valueAtScope);
	}
	newValue[configKey] = value;
	await vscode.workspace.getConfiguration().update(rootKey, newValue, scope);
}


type ConfigUpdater<T> = (configKey: string, value: T, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean) => Promise<void>;
type ConfigUpdaterForRoot<T> = (rootKey: string, configKey: string, value: T, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean) => Promise<void>;

async function atAllConfigScopes<T>(fn: ConfigUpdater<T>, configKey: string, value: T): Promise<void> {
	const config = vscode.workspace.getConfiguration().inspect(EXTENSION_CONFIG_KEY)!;
	await fn(configKey, value, vscode.ConfigurationTarget.Global, config.globalValue, true);
	await fn(configKey, value, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
	await fn(configKey, value, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
}

async function atAllConfigScopesWithRoot<T>(fn: ConfigUpdaterForRoot<T>, rootKey : string, configKey: string, value: T): Promise<void> {
	const config = vscode.workspace.getConfiguration(rootKey).inspect(EXTENSION_CONFIG_KEY)!;
	await fn(rootKey, configKey, value, vscode.ConfigurationTarget.Global, config.globalValue, true);
	await fn(rootKey, configKey, value, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
	await fn(rootKey, configKey, value, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
}

export function getConfiguration(key: string): any {
	return vscode.workspace.getConfiguration(key);
}

export function getToolPath(tool: string): string | undefined {
	const baseKey = toolPathBaseKey(tool);
	return getPathSetting(baseKey);
}

function getPathSetting(baseKey: string): string | undefined {
	const os = platform();
	const osOverridePath = getConfiguration(EXTENSION_CONFIG_KEY)[osOverrideKey(os, baseKey)];
	return osOverridePath || getConfiguration(EXTENSION_CONFIG_KEY)[baseKey];
}

export function toolPathBaseKey(tool: string): string {
	return `camelk.tools.${tool}-path`;
}

function osOverrideKey(os: string, baseKey: string): string {
	const osKey = osKeyString(os);
	return osKey ? `${baseKey}.${osKey}` : baseKey;  // The 'else' clause should never happen so don't worry that this would result in double-checking a missing base key
}

function osKeyString(os: string): string | null {
	switch (os) {
		case 'win32': return 'windows';
		case 'darwin': return 'mac';
		case 'linux': return 'linux';
		default: return null;
	}
}

export function getActiveKamelconfig(): string {
	return vscode.workspace.getConfiguration(EXTENSION_CONFIG_KEY)[KAMEL_PATH_CONFIG_KEY];
}

export function getActiveKubectlconfig(): string {
	return vscode.workspace.getConfiguration(KUBERNETES_EXTENSION_CONFIG_KEY)[KUBECTL_PATH_CONFIG_KEY];
}

export async function addNamespaceToConfig(value: string | undefined): Promise<void> {
	await vscode.workspace.getConfiguration().update(NAMESPACE_KEY, value, true);
}

export function getNamespaceconfig(): string | undefined {
	const namespace : string | undefined = vscode.workspace.getConfiguration().get(NAMESPACE_KEY);
	if (!namespace ||namespace.length === 0) {
		return undefined;
	}
	return namespace;
}

export function getKamelRuntimeVersionConfig(): string | undefined {
	const runtimeVersionSetting : string = vscode.workspace.getConfiguration().get(RUNTIME_VERSION_KEY, version);
	if (!runtimeVersionSetting || runtimeVersionSetting.length === 0) {
		return undefined;
	}
	return runtimeVersionSetting;
}

export async function setKamelRuntimeVersionConfig(value : string) : Promise<void> {
	const configuration = vscode.workspace.getConfiguration();
	return await configuration.update(RUNTIME_VERSION_KEY, value.toLowerCase().startsWith('v') ? value.substring(1) : value, vscode.ConfigurationTarget.Global);
}

export function getKamelAutoupgradeConfig() : boolean {
	const configuration = vscode.workspace.getConfiguration();
	return configuration.get(AUTOUPGRADE_KEY, true) as boolean;
}

// for testing purposes 
export async function setKamelAutoupgradeConfig(value : boolean) : Promise<void> {
	const configuration = vscode.workspace.getConfiguration();
	return await configuration.update(AUTOUPGRADE_KEY, value, vscode.ConfigurationTarget.Global);
}
