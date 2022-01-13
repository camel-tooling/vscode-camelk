import { assert } from 'chai';
import path = require('path');
import {
	CustomTreeSection,
	EditorView,
	InputBox,
	SideBarView,
	ViewItem,
	VSBrowser,
	Workbench
} from 'vscode-extension-tester';
import { DefaultWait } from 'vscode-uitests-tooling';

describe('Tooling for Apache Camel K extension', function () {

	before(async function () {
		this.timeout(90000);
		await new EditorView().closeAllEditors();
		const workspaceFolder = path.join(__dirname, '../../../test Fixture with speci@l chars');
		await VSBrowser.instance.openResources(workspaceFolder);
		// have a conditional wait for the extension to be activated
		await VSBrowser.instance.driver.sleep(30000);
	});
	
	after(async function () {
		await new EditorView().closeAllEditors();
	});
	
	describe('Java Debug', function () {
		
		it('Create File Deploy it and Check Java Debug available', async function () {
			this.timeout(20000);
			await createIntegration('JavaDebugTest');
			
			const integrationLabel = 'java-debug-test';
			const section = await startIntegration(integrationLabel);

			const item = await section.findItem(integrationLabel) as ViewItem;
			const menu = await item.openContextMenu();
			assert.isTrue(await menu.hasItem('Start Java debugger on Camel K integration'));
			
			//TODO: in another iteration, actually click on the java debug contextual menu, but need to modify the code before and provide a breakpoint
		});

		it('Create invalid File, Deploy it and Check Java Debug is not available', async function () {
			this.timeout(20000);
			await createIntegration('JavaInvalidDebugTest');
			
			// TODO: modify file to be invalid but still appear in deployment
			
			const integrationLabel = 'java-invalid-debug-test';
			const section = await startIntegration(integrationLabel);

			// TODO: check Java debug is available on right-click
			const item = await section.findItem(integrationLabel) as ViewItem;
			const menu = await item.openContextMenu();
			assert.isFalse(await menu.hasItem('Start Java debugger on Camel K integration'));
			
		});

	});

});
async function startIntegration(integrationLabel: string) {
	const workbench = new Workbench();
	await workbench.executeCommand('Start Apache Camel K Integration');
	console.log('Start command');
	const startMode = await InputBox.create();
	await startMode.selectQuickPick('Basic');

	const section = await new SideBarView().getContent().getSection('Apache Camel K Integrations') as CustomTreeSection;
	await section.expand();

	await DefaultWait.sleep(2000); // TODO: not nice, need to remove or replace with dynamic wait


	// verify that started integration is properly running and visible inside Camel K integrations view
	const visibleItems = await section.getVisibleItems();
	let found = false;
	for (const visibleItem of visibleItems) {
		if (integrationLabel === await visibleItem.getText()) {
			found = true;
		}
	}
	assert.isTrue(found, `The integration with label ${integrationLabel} has not been found in visible items.`);
	console.log('integration started');
	return section;
}

async function createIntegration(fileName: string) {
	const workbench = new Workbench();
	await workbench.executeCommand('Create a new Apache Camel K Integration file');
	const languageInput = await InputBox.create();
	await languageInput.selectQuickPick('Java');
	const workspaceFolderInput = await InputBox.create();
	await workspaceFolderInput.selectQuickPick(0);
	const nameInput = await InputBox.create();
	await nameInput.setText(fileName);
	await nameInput.confirm();

	const editorView = new EditorView();
	await VSBrowser.instance.driver.wait(async() => {
		try {
			return await editorView.openEditor(fileName + '.java') !== undefined;
		} catch {
			return false;
		}
	});
	console.log('integration created');
	return workbench;
}

