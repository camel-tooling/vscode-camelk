import * as pjson from '../../package.json';
import { assert } from 'chai';
import { DefaultWait, Marketplace } from 'vscode-uitests-tooling';
import {
	EditorView,
	ExtensionsViewItem,
	ExtensionsViewSection,
	SideBarView,
	TitleBar,
	until,
	VSBrowser
} from 'vscode-extension-tester';

describe('Tooling for Apache Camel K extension', function () {

	describe('Extensions view', function () {

		let section: ExtensionsViewSection;
		let item: ExtensionsViewItem;

		before(async function () {
			this.timeout(10000);
			
		});

		after(async function () {
			await new EditorView().closeAllEditors();
		});

		it('Find extension', async function () {
			
			this.timeout(10000);
			VSBrowser.instance.driver.wait(until.elementIsEnabled(new TitleBar()));
			console.log('loop get title bar');
			VSBrowser.instance.driver.wait(async() => {
					console.log('try to get title bar view -> Extensions')
					try {
						return await new TitleBar().select('View', 'Extensions') !== undefined;
					} catch (e){
						console.log(e);
						return false;
					}
				}, 10000
			);
			console.log('get title bar view extensions');
			await new TitleBar().select('View', 'Extensions');
			console.log('will get anySection...')
			await new Marketplace().getAnySection(1000);
			await Marketplace.open(10000);
			await DefaultWait.sleep(1000);
			section = await new SideBarView().getContent().getSection('Installed') as ExtensionsViewSection;
			
			item = await section.findItem(`@installed ${pjson.displayName}`) as ExtensionsViewItem;
			assert.isNotNull(item);
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
