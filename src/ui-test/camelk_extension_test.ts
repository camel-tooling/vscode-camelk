import * as pjson from '../../package.json';
import { assert } from 'chai';
import { DefaultWait, Marketplace } from 'vscode-uitests-tooling';
import {
	EditorView,
	ExtensionsViewItem,
	ExtensionsViewSection,
	SideBarView
} from 'vscode-extension-tester';

describe('Tooling for Apache Camel K extension', function () {

	describe('Extensions view', function () {

		let section: ExtensionsViewSection;
		let item: ExtensionsViewItem;

		before(async function () {
			this.timeout(10000);
			await Marketplace.open();
			await DefaultWait.sleep(1000);
			section = await new SideBarView().getContent().getSection('Installed') as ExtensionsViewSection;
		});

		after(async function () {
			await new EditorView().closeAllEditors();
		});

		it('Find extension', async function () {
			this.timeout(10000);
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
