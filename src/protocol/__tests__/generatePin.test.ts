import { expect, test} from 'vitest';
import { generatePin } from '../generatePin';

test('numeric pin code of 4 characters', () => {
    let testRun = 100;
    while (testRun > 0) {
        let pin = generatePin('numeric', 4);
        expect(!!(pin || false)).toBe(true);
        expect(pin.length).toBe(4);
        expect(pin.match(/^[0-9]+$/)).toBeTruthy();
        testRun -= 1;
    }
});

test('numeric pin code of 6 characters', () => {
    let testRun = 100;
    while (testRun > 0) {
        let pin = generatePin('numeric', 6);
        expect(!!(pin || false)).toBe(true);
        expect(pin.length).toBe(6);
        expect(pin.match(/^[0-9]+$/)).toBeTruthy();
        testRun -= 1;
    }
});

test('text code of 6 characters', () => {
    let testRun = 100;
    while (testRun > 0) {
        let pin = generatePin('text', 6);
        expect(!!(pin || false)).toBe(true);
        expect(pin.length).toBe(6);
        expect(pin.match(/^[A-Z]+$/)).toBeTruthy();
        testRun -= 1;
    }
});
