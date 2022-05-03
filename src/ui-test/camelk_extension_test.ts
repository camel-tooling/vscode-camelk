import * as pjson from '../../package.json';
import { assert } from 'chai';
import {
	EditorView,
	ExtensionsViewItem
} from 'vscode-extension-tester';
import {
	Marketplace
} from 'vscode-uitests-tooling';

describe('Language Support for Apache Camel extension', function () {
	this.timeout(60000);

	describe('Extensions view', function () {
		let marketplace: Marketplace;
		let item: ExtensionsViewItem;

		before(async function () {
			this.retries(5);
			marketplace = await Marketplace.open(this.timeout());
		});

		after(async function () {
			await marketplace.close();
			await new EditorView().closeAllEditors();
		});

		it('Find extension', async function () {
			item = await marketplace.findExtension(`@installed ${pjson.displayName}`);
		});

		it('Extension is installed', async function () {
			const installed = await item.isInstalled();
			assert.isTrue(installed);
		});

		it('Verify display name', async function () {
			const title = await item.getTitle();
			assert.equal(title, `${pjson.displayName}`);
		});

		it('Verify description', async function () {
			const desc = await item.getDescription();
			assert.equal(desc, `${pjson.description}`);
		});

		it('Verify version', async function () {
			const version = await item.getVersion();
			assert.equal(version, `${pjson.version}`);
		});
	});

});
