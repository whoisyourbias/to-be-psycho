import assert from 'node:assert/strict';
import { adjustQuantity } from './app.js';
assert.equal(adjustQuantity(2, 1), 3);
assert.equal(adjustQuantity(10, 1), 10);
