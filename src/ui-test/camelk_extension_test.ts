import * as pjson from '../../package.json';
import { assert } from 'chai';
import {
	By,
	EditorView,
	ExtensionsViewItem,
	until,
	VSBrowser,
	WebDriver
} from 'vscode-extension-tester';
import {
	Marketplace, StatusBarExt
} from 'vscode-uitests-tooling';

describe('Language Support for Apache Camel extension', function () {
	this.timeout(60000);

	describe('Extensions view', function () {
		let marketplace: Marketplace;
		let item: ExtensionsViewItem;
		let driver: WebDriver;

		before(async function () {
			this.retries(5);
			driver = VSBrowser.instance.driver;
			marketplace = await Marketplace.open(this.timeout());
		});

		after(async function () {
			await marketplace.close();
			await new EditorView().closeAllEditors();
		});

		it('Downloading of Apache Camel K CLI', async function () {
			const statusbar = await driver.wait(until.elementLocated(By.id('redhat.vscode-camelk')), 35000);
			await driver.wait(async () => {
				const text = await statusbar.getText().catch(() => '');
				try {
					return text.startsWith('Download progress: ') && text.includes('100%');
				}
				catch {
					return false;
				}
			}, this.timeout() - 3000, `Could not find Apache Camel K element with label "Download progress: ...". Current label: "${await new StatusBarExt().getItemByID('redhat.vscode-camelk').catch(() => 'unknown')}"`);
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
