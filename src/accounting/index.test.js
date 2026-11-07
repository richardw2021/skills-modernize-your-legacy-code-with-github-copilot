'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const { createAccount, formatBalance, parseAmount } = require('./index');

function runApp(lines) {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'index.js')], {
    input: lines.join('\n') + '\n',
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.ifError(result.error);
  return result;
}

test('parses valid amounts exactly as cents and formats balances', () => {
  for (const [input, cents] of [
    ['0', 0], ['10', 1000], ['12.34', 1234], ['0.1', 10],
    ['000001.01', 101], ['999999.99', 99999999],
  ]) {
    assert.deepEqual(parseAmount(input), { cents });
  }
  assert.equal(formatBalance(100000), '001000.00');
  assert.equal(formatBalance(99999999), '999999.99');
});

test('rejects invalid amounts and amounts above the maximum', () => {
  for (const input of ['', ' ', 'abc', '-1.00', '+1', '1.234', '.5', '1.', '1e2', '1000000']) {
    assert.ok(parseAmount(input).error, input);
  }
});

test('account transactions preserve exact cents and enforce balance limits', () => {
  const account = createAccount();
  assert.equal(account.getBalance(), 100000);
  assert.deepEqual(account.credit(1), { balance: 100001 });
  assert.deepEqual(account.debit(2), { balance: 99999 });
  assert.deepEqual(account.debit(100000), { error: 'Insufficient funds for this debit.' });
  assert.equal(account.getBalance(), 99999);
  assert.deepEqual(account.debit(99999), { balance: 0 });
  assert.deepEqual(account.debit(0), { balance: 0 });
  assert.deepEqual(account.credit(99999999), { balance: 99999999 });
  assert.deepEqual(account.credit(1), { error: 'Credit would exceed the maximum balance of 999999.99.' });
  assert.equal(account.getBalance(), 99999999);
  for (const invalid of [-1, 0.1, NaN, Infinity, 100000000]) {
    assert.throws(() => account.credit(invalid), RangeError);
    assert.throws(() => account.debit(invalid), RangeError);
  }
  assert.equal(account.getBalance(), 99999999);
});

test('menu processes multiple operations and maintains one shared balance', () => {
  const result = runApp(['1', '2', '100.00', '3', '25.50', '2', '0.01', '1', '4']);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  for (const text of [
    '1. View Balance', '2. Credit Account', '3. Debit Account', '4. Exit',
    'Current balance: 001000.00', 'Amount credited. New balance: 001100.00',
    'Amount debited. New balance: 001074.50', 'Amount credited. New balance: 001074.51',
    'Current balance: 001074.51', 'Exiting the program. Goodbye!',
  ]) {
    assert.ok(result.stdout.includes(text), text);
  }
});

test('rejects insufficient funds and invalid input without changing the balance', () => {
  const result = runApp(['9', '3', '1000.01', '2', '-1.00', '3', 'abc', '1', '4']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Invalid choice, please select 1-4\./);
  assert.match(result.stdout, /Insufficient funds for this debit\./);
  assert.equal((result.stdout.match(/Invalid amount\./g) || []).length, 2);
  assert.match(result.stdout, /Current balance: 001000\.00/);
});

test('zero transactions, exact debit and overflow preserve balance integrity', () => {
  const result = runApp([
    '2', '0', '3', '0', '3', '1000.00', '3', '0.01',
    '2', '999999.99', '2', '0.01', '1', '4',
  ]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Amount credited\. New balance: 001000\.00/);
  assert.match(result.stdout, /Amount debited\. New balance: 001000\.00/);
  assert.match(result.stdout, /Amount debited\. New balance: 000000\.00/);
  assert.match(result.stdout, /Insufficient funds for this debit\./);
  assert.match(result.stdout, /Credit would exceed the maximum balance of 999999\.99\./);
  assert.match(result.stdout, /Current balance: 999999\.99/);
});

test('balance resets for a new process', () => {
  assert.match(runApp(['2', '10', '4']).stdout, /001010\.00/);
  assert.match(runApp(['1', '4']).stdout, /Current balance: 001000\.00/);
});

test('reports closed input at the menu and at an amount prompt', () => {
  const menu = runApp([]);
  assert.equal(menu.status, 1);
  assert.match(menu.stderr, /Input ended before the application was exited\./);
  const amount = runApp(['2']);
  assert.equal(amount.status, 1);
  assert.match(amount.stderr, /Input ended before an amount was entered\./);
});
