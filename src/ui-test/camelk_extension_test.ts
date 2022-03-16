import * as pjson from '../../package.json';
import { assert } from 'chai';
import {
	EditorView,
	ExtensionsViewItem,
	ExtensionsViewSection,
	InputBox,
	SideBarView,
	TitleBar,
	until,
	VSBrowser,
	Workbench
} from 'vscode-extension-tester';

describe('Tooling for Apache Camel K extension', function () {

	describe('Extensions view', function () {

		let section: ExtensionsViewSection;
		let item: ExtensionsViewItem;
		let input :InputBox;

		before(async function () {
			this.timeout(10000);
			
		});

		after(async function () {
			await new EditorView().closeAllEditors();
		});

		it('Find extension', async function () {
			
			this.timeout(30000);
			await VSBrowser.instance.driver.wait(until.elementIsEnabled(new TitleBar()));
			await VSBrowser.instance.driver.wait(until.elementIsVisible(new Workbench()));
			// console.log('loop get title bar');
			// VSBrowser.instance.driver.wait(async() => {
			// 		console.log('try to get title bar view -> Extensions')
			// 		try {
			// 			return await new TitleBar().select('View', 'Extensions') !== undefined;
			// 		} catch (e){
			// 			console.log(e);
			// 			return false;
			// 		}
			// 	}, 10000
			// );
			// console.log('get title bar view extensions');
			// await new TitleBar().select('View', 'Extensions');
			//DefaultWait.sleep(5000);
			
			// await VSBrowser.instance.driver.wait(async() => {
			// 		console.log('try to get openview')
			// 		try {
			// 			await new Workbench().executeCommand('View: Open View');
			// 			console.log('command View: Open View executed');
			// 			input = await InputBox.create();
			// 			return input != undefined;
			// 		} catch (e){
			// 			console.log(e);
			// 			return false;
			// 		}
			// 	}, 10000
			// );
			await new Workbench().executeCommand('View: Open View');
			console.log('command View: Open View executed');
			input = await InputBox.create();
			console.log('input box retrieved');
			await input.setText('view Extensions');
			console.log('text set in input box');
			await input.click();
			
			
			// console.log('will get anySection...')
			// await new Marketplace().getAnySection(1000);
			// await Marketplace.open(10000);
			// await DefaultWait.sleep(1000);
			section = await new SideBarView().getContent().getSection('Installed') as ExtensionsViewSection;
			console.log('section extensiosn retrieved');
			
			await VSBrowser.instance.driver.wait(async() => {
					console.log('try to get openview')
					item = await section.findItem(`@installed ${pjson.displayName}`) as ExtensionsViewItem;
					return item !== undefined;
				}, 10000
			);
			
			//item = await section.findItem(`@installed ${pjson.displayName}`) as ExtensionsViewItem;
			console.log('item found in section');
			assert.isNotNull(item);
			assert.isDefined(item);
		});

		it('Extension is installed', async function () {
			this.timeout(5000);
			const installed = await item.isInstalled();
			assert.isTrue(installed);
		});

		it('Verify author', async function () {
			this.timeout(5000);
			const author = await item.getAuthor();
			assert.equal(author, 'Red Hat');
		});

		it('Verify display name', async function () {
			this.timeout(5000);
			const title = await item.getTitle();
			assert.equal(title, `${pjson.displayName}`);
		});

		it('Verify description', async function () {
			this.timeout(5000);
			const desc = await item.getDescription();
			assert.equal(desc, `${pjson.description}`);
		});

		it('Verify version', async function () {
			this.timeout(5000);
			const version = await item.getVersion();
			assert.equal(version, `${pjson.version}`);
		});
	});

});
