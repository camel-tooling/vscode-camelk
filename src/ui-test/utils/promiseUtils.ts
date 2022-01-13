import { assert } from "chai";

export const promiseSucceed = async (proms: any) => await assertPromise(proms);
export const promiseFail = async (proms: any) => await assertPromise(proms, false);

const assertPromise = async (prom: any, succed = true) => {
    succed = succed ? true : false;
    try {
        prom = Array.isArray(prom) ? prom : [prom];
        await Promise.all(prom);
        assert.strictEqual(true, succed);
    }
    catch (ex: any) { assert.notStrictEqual(true, succed, ex); }
}
