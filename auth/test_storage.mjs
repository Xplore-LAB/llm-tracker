import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const local = new Map([['legacy-progress', 'unassigned']]);
const session = new Map();
function openUser(id) {
  class Storage {
    constructor(map) { this.map = map; }
    getItem(k) { return this.map.get(String(k)) ?? null; }
    setItem(k, v) { this.map.set(String(k), String(v)); }
    removeItem(k) { this.map.delete(String(k)); }
    key(i) { return [...this.map.keys()][i] ?? null; }
    clear() { this.map.clear(); }
    get length() { return this.map.size; }
  }
  const context = {window: {trackerUser: {id}}, Storage,
    localStorage: new Storage(local), sessionStorage: new Storage(session),
    addEventListener() {}, setInterval() {}, document: {addEventListener() {}}};
  vm.runInNewContext(readFileSync(new URL('./ui/session.js', import.meta.url), 'utf8'), context);
  return context;
}
const alice = openUser('alice');
assert.equal(alice.localStorage.getItem('legacy-progress'), null);
alice.localStorage.setItem('progress', 'chapter-3');
alice.sessionStorage.setItem('draft', 'alice-draft');
const bob = openUser('bob');
assert.equal(bob.localStorage.getItem('progress'), null);
assert.equal(bob.sessionStorage.getItem('draft'), null);
bob.localStorage.setItem('progress', 'chapter-1');
assert.equal(alice.localStorage.getItem('progress'), 'chapter-3');
assert.equal(alice.localStorage.length, 1);
assert.equal(bob.localStorage.key(0), 'progress');
bob.localStorage.clear();
assert.equal(alice.localStorage.getItem('progress'), 'chapter-3');
assert.equal(local.get('legacy-progress'), 'unassigned');
assert.equal(openUser('alice').localStorage.getItem('progress'), 'chapter-3');
console.log('PASS: account switching, persistence, enumeration, clear, and legacy-record isolation');
