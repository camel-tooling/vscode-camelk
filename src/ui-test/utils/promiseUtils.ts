import { assert } from "chai";

export const assertPromiseSucceed = async (proms: any, failMessage?: string) => await assertPromise(proms, true, failMessage);
export const assertPromiseFail = async (proms: any, failMessage?: string) => await assertPromise(proms, false, failMessage);

const assertPromise = async (prom: any, assertSucceed = true, failMessage?: string) => {

    const toAssert = assertSucceed ? true : false;
    
    try {
        prom = Array.isArray(prom) ? prom : [prom];
        await Promise.all(prom);
        assert.strictEqual(true, toAssert, failMessage);
    } catch (ex: any) { 
        assert.notStrictEqual(
            true, toAssert, 
            failMessage ? failMessage : ex
        ); 
    }
}
