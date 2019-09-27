import * as vscode from 'vscode';
import {platform} from 'os';

export const EXTENSION_CONFIG_KEY = "camelk.tools";
export const KAMEL_PATH_CONFIG_KEY = "camelk.tools.kamel-path";
export const KUBERNETES_EXTENSION_CONFIG_KEY = "vs-kubernetes";
export const KUBECTL_PATH_CONFIG_KEY = "vs-kubernetes.kubectl-path";

export async function addKamelPathToConfig(value: string) : Promise<void> {
	await setConfigValue(KAMEL_PATH_CONFIG_KEY, value);
}

export async function addPathToConfig(configKey: string, value: string): Promise<void> {
	await setConfigValue(configKey, value);
}

async function setConfigValue(configKey: string, value: any): Promise<void> {
	await atAllConfigScopes(addValueToConfigAtScope, configKey, value);
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

type ConfigUpdater<T> = (configKey: string, value: T, scope: vscode.ConfigurationTarget, valueAtScope: any, createIfNotExist: boolean) => Promise<void>;

async function atAllConfigScopes<T>(fn: ConfigUpdater<T>, configKey: string, value: T): Promise<void> {
	const config = vscode.workspace.getConfiguration().inspect(EXTENSION_CONFIG_KEY)!;
	await fn(configKey, value, vscode.ConfigurationTarget.Global, config.globalValue, true);
	await fn(configKey, value, vscode.ConfigurationTarget.Workspace, config.workspaceValue, false);
	await fn(configKey, value, vscode.ConfigurationTarget.WorkspaceFolder, config.workspaceFolderValue, false);
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