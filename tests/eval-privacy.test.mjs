import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const results = new URL('tests/evals/results/', root);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const rows = (await Promise.all((await fs.readdir(results)).map(async file =>
  (await fs.readFile(new URL(file, results), 'utf8')).trim().split('\n').map(JSON.parse)
))).flat();

test('public evaluation records omit execution locators and coordination instructions', () => {
  assert.equal(rows.length, 88);
  assert.equal(new Set(rows.map(row => row.runId)).size, rows.length);
  for (const row of rows) {
    assert.match(row.runId, /^eval-[0-9a-f-]{36}$/);
    assert.equal('promptPath' in row, false);
    assert.equal('promptLoadingInstruction' in row, false);
    assert.doesNotMatch(JSON.stringify(row), /\/workspace\/|\/root\/|\.superpowers\/|owner chat|spawn agents|exec_command|Do not mention the prompt loading/);
    assert.equal(row.publicExport.format, 'redacted-v1');
    assert.equal(row.publicExport.originalPromptAvailable, false);
    assert.match(row.promptHash, /^[0-9a-f]{64}$/);
    assert.equal(sha(row.transcript[0].content), row.publicPromptHash);
    assert.notEqual(row.publicPromptHash, row.promptHash);
  }
});

test('exported guided prompts contain only project guidance, fixture and learner request', () => {
  for (const row of rows.filter(row => row.variant === 'guided')) {
    const prompt = row.transcript[0].content;
    assert.ok(prompt.startsWith('Use this supplied learning guidance.\n\n--- skills/'));
    const sections = [...prompt.matchAll(/^--- (.+) ---$/gm)];
    assert.deepEqual(sections.map(section => section[1]).sort(), Object.keys(row.guidanceHashes).sort());
    for (const [index, section] of sections.entries()) {
      assert.match(section[1], /^(skills\/learning-with-to-be-psycho\/SKILL\.md|core\/[a-z-]+\.md|profiles\/[a-z-]+\.md|adapters\/(claude|codex)\/[a-zA-Z.-]+)$/);
      const end = sections[index + 1]?.index ?? prompt.indexOf('Fixture app.js:');
      const content = prompt.slice(section.index + section[0].length + 1, end - 2);
      assert.equal(sha(content), row.guidanceHashes[section[1]], section[1]);
    }
  }
});
