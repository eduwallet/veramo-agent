import { expect, test} from 'vitest';
import { createUniqueId } from '../createUniqueId.js';

test("check length", () => {
    const id = createUniqueId();
    expect(id).toBeDefined();
    expect(id.length).toBe(32);
    expect(id.indexOf('-')).toBe(-1);
});

test("check uniqueness", () => {
    let elements:string[] = [];
    for(var i = 0; i < 10000; i++) {
        const id = createUniqueId();
        expect(elements.indexOf(id)).toBe(-1);
        elements.push(id);
    }
});
