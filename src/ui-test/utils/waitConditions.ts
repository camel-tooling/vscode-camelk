import { By, ExtensionsViewItem } from "vscode-extension-tester";

export async function extensionIsActivated(extension: ExtensionsViewItem, timePeriod = 2000): Promise<boolean> {
    try {
        const activationTime = await extension.findElement(By.className('activationTime'));
        if (activationTime !== undefined) {
            console.log('Extension was activated in time: ' + await activationTime.getText());
            return true;
        } else {
            await extension.getDriver().sleep(timePeriod);
            console.log('Extension was not activated yet!');
            return false;
        }
    } catch (err) {
        await extension.getDriver().sleep(timePeriod);
        console.log('Extension was not activated yet!');
        return false;
    }
}