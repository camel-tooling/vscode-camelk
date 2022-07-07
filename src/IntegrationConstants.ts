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
'use strict';

export const validNameRegex = /^[A-Za-z][A-Za-z0-9\-.]*(?:[A-Za-z0-9]$){1}/;
export const devModeIntegration = 'Dev Mode - Apache Camel K Integration in Dev Mode';
export const basicIntegration = 'Basic - Apache Camel K Integration without extra options';
export const configMapIntegration = 'ConfigMap - Apache Camel K Integration with Kubernetes ConfigMap as Runtime Configuration';
export const secretIntegration = 'Secret - Apache Camel K Integration with Kubernetes Secret as Runtime Configuration';
export const resourceIntegration = 'Resource - Apache Camel K Integration with Resource file';
export const propertyIntegration = 'Property - Apache Camel K Integration with Property';
export const dependencyIntegration = 'Dependencies - Apache Camel K Integration with Explicit Dependencies';
export const vscodeTasksIntegration = 'Use a predefined Task - useful for multi-attributes deployment';

export const choiceList = [
	devModeIntegration,
	basicIntegration,
	configMapIntegration,
	secretIntegration,
	resourceIntegration,
	propertyIntegration,
	dependencyIntegration,
	vscodeTasksIntegration
];

export const LANGUAGES_WITH_FILENAME_EXTENSIONS = new Map([
	['Java', 'java'],
	['XML', 'xml'],
	['Yaml', 'yaml'],
	['Groovy', 'groovy'],
	['JavaScript', 'js'],
	['Kotlin', 'kts']]);

export const LANGUAGES = Array.from(LANGUAGES_WITH_FILENAME_EXTENSIONS.keys());
