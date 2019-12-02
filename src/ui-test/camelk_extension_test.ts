import { EditorView, ExtensionsViewItem } from 'vscode-extension-tester';
import { Marketplace } from 'vscode-uitests-tooling';
import { assert } from 'chai';
import * as pjson from '../../package.json';

describe('Tooling for Apache Camel K extension', function () {

	describe('Extensions view', function () {

		let marketplace: Marketplace;
		let item: ExtensionsViewItem;

		before(async function () {
			this.timeout(10000);
			marketplace = await Marketplace.open();
		});

		after(async function () {
			await marketplace.close();
			await new EditorView().closeAllEditors();
		});

		it('Find extension', async function () {
			this.timeout(10000);
			item = await marketplace.findExtension(`@installed ${pjson.displayName}`) as ExtensionsViewItem; 
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
