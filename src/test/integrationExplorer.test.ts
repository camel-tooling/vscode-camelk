import * as vscode from 'vscode';
import * as chai from 'chai';
import { CamelKNodeProvider, TreeNode } from '../CamelKNodeProvider';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

const expect = chai.expect;
chai.use(sinonChai);

suite('Camel-k Integrations View', () => {

	let sandbox: sinon.SinonSandbox;
	let integrationExplorer: CamelKNodeProvider;

	setup(() => {
		sandbox = sinon.createSandbox();

		integrationExplorer = new CamelKNodeProvider();
	});

	teardown(() => {
		sandbox.restore();
	});

	test('getChildren call with dummy node should add integration to tree data model', async () => {
		const newNode = new TreeNode("string", "mockIntegration", vscode.TreeItemCollapsibleState.None);
        const children = await integrationExplorer.getChildren(newNode);

        expect(children.length).equals(1);
        expect(children[0].label).equals("mockIntegration");
	});

});