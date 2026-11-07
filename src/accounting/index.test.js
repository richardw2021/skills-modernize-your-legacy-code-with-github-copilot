'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const { createAccount, formatBalance, parseAmount } = require('./index');

function runApp(lines) {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'index.js')], {
    input: `${lines.join('\n')}\n`,
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.ifError(result.error);
  return result;
}

function assertAppOutput(lines, expected, unexpected = []) {
  const result = runApp(lines);
  assert.equal(result.status, 0, result.stderr);
  for (const text of expected) assert.ok(result.stdout.includes(text), text);
  for (const text of unexpected) assert.ok(!result.stdout.includes(text), text);
  return result.stdout;
}

function assertTransaction(method, cents, expected) {
  const account = createAccount();
  assert.deepEqual(account[method](cents), expected);
}

test('MENU-01: displays the menu, initial balance, and returns to the menu', () => {
  const output = assertAppOutput(['1', '4'], [
    'Account Management System',
    '1. View Balance',
    '2. Credit Account',
    '3. Debit Account',
    '4. Exit',
    'Enter your choice (1-4):',
    'Current balance: 001000.00',
  ]);
  assert.equal((output.match(/Account Management System/g) || []).length, 2);
});

test('MENU-02: exits without a transaction', () => {
  const output = assertAppOutput(['4'], ['Exiting the program. Goodbye!'], [
    'Current balance:',
    'Enter credit amount:',
    'Enter debit amount:',
  ]);
  assert.equal((output.match(/Account Management System/g) || []).length, 1);
});

test('MENU-03: rejects an unsupported menu digit without changing the balance', () => {
  assertAppOutput(['9', '1', '4'], [
    'Invalid choice, please select 1-4.',
    'Current balance: 001000.00',
  ]);
});

test('MENU-04: rejects nonnumeric and blank menu input', () => {
  const output = assertAppOutput(['a', '', '1', '4'], [
    'Invalid choice, please select 1-4.',
    'Current balance: 001000.00',
  ]);
  assert.equal((output.match(/Invalid choice, please select 1-4\./g) || []).length, 2);
});

test('MENU-05: rejects a multi-digit menu choice instead of truncating it', () => {
  assertAppOutput(['12', '4'], [
    'Invalid choice, please select 1-4.',
    'Exiting the program. Goodbye!',
  ], ['Current balance:']);
});

test('VIEW-01: repeated balance inquiries do not change the balance', () => {
  const output = assertAppOutput(['1', '1', '4'], ['Current balance: 001000.00']);
  assert.equal((output.match(/Current balance: 001000\.00/g) || []).length, 2);
});

test('CREDIT-01: credits a decimal amount and makes it visible to a later inquiry', () => {
  assertAppOutput(['2', '12.34', '1', '4'], [
    'Enter credit amount:',
    'Amount credited. New balance: 001012.34',
    'Current balance: 001012.34',
  ]);
});

test('CREDIT-02: credits an integer amount', () => {
  assertTransaction('credit', 1000, { balance: 101000 });
  assert.equal(formatBalance(101000), '001010.00');
});

test('CREDIT-03: accepts a zero-value credit without changing the balance', () => {
  assertAppOutput(['2', '0', '1', '4'], [
    'Amount credited. New balance: 001000.00',
    'Current balance: 001000.00',
  ]);
});

test('CREDIT-04: credits one cent exactly', () => {
  assertTransaction('credit', 1, { balance: 100001 });
  assert.equal(formatBalance(100001), '001000.01');
});

test('DEBIT-01: debits less than the balance and reports the resulting balance', () => {
  assertAppOutput(['3', '12.34', '1', '4'], [
    'Enter debit amount:',
    'Amount debited. New balance: 000987.66',
    'Current balance: 000987.66',
  ]);
});

test('DEBIT-02: permits a debit equal to the full balance', () => {
  assertAppOutput(['3', '1000.00', '1', '4'], [
    'Amount debited. New balance: 000000.00',
    'Current balance: 000000.00',
  ]);
});

test('DEBIT-03: rejects a debit one cent above the balance without changing it', () => {
  assertAppOutput(['3', '1000.01', '1', '4'], [
    'Insufficient funds for this debit.',
    'Current balance: 001000.00',
  ], ['Amount debited.']);
});

test('DEBIT-04: accepts a zero-value debit without changing the balance', () => {
  assertTransaction('debit', 0, { balance: 100000 });
  assert.equal(formatBalance(createAccount().getBalance()), '001000.00');
});

test('DEBIT-05: zero-balance account accepts zero but rejects a positive debit', () => {
  const account = createAccount();
  assert.deepEqual(account.debit(100000), { balance: 0 });
  assert.deepEqual(account.debit(0), { balance: 0 });
  assert.deepEqual(account.debit(1), { error: 'Insufficient funds for this debit.' });
  assert.equal(account.getBalance(), 0);
});

test('FLOW-01: credits and debits share one balance throughout a session', () => {
  assertAppOutput(['2', '100.00', '3', '25.50', '2', '0.01', '1', '4'], [
    'Amount credited. New balance: 001100.00',
    'Amount debited. New balance: 001074.50',
    'Amount credited. New balance: 001074.51',
    'Current balance: 001074.51',
  ]);
});

test('FLOW-02: a rejected debit does not prevent a later valid debit', () => {
  assertAppOutput(['3', '1000.01', '3', '1.00', '1', '4'], [
    'Insufficient funds for this debit.',
    'Amount debited. New balance: 000999.00',
    'Current balance: 000999.00',
  ]);
});

test('FLOW-03: a fresh process starts with the initial in-memory balance', () => {
  assert.match(assertAppOutput(['2', '10', '4'], ['001010.00']), /001010\.00/);
  assert.match(assertAppOutput(['1', '4'], ['Current balance: 001000.00']), /001000\.00/);
});

test('INPUT-01: rejects negative credit input and preserves the balance', () => {
  assertAppOutput(['2', '-1.00', '1', '4'], [
    'Invalid amount.',
    'Current balance: 001000.00',
  ], ['Amount credited.']);
});

test('INPUT-02: rejects negative debit input and preserves the balance', () => {
  assertAppOutput(['3', '-1.00', '1', '4'], [
    'Invalid amount.',
    'Current balance: 001000.00',
  ], ['Amount debited.']);
});

test('INPUT-03: rejects alphabetic credit input and preserves the balance', () => {
  assertAppOutput(['2', 'abc', '1', '4'], [
    'Invalid amount.',
    'Current balance: 001000.00',
  ], ['Amount credited.']);
});

test('INPUT-04: rejects blank credit input and preserves the balance', () => {
  assertAppOutput(['2', '', '1', '4'], [
    'Invalid amount.',
    'Current balance: 001000.00',
  ], ['Amount credited.']);
});

test('INPUT-05: rejects more than two fractional digits rather than truncating', () => {
  assertAppOutput(['2', '0.019', '1', '4'], [
    'Invalid amount.',
    'Current balance: 001000.00',
  ], ['Amount credited.']);
});

test('INPUT-06: accepts the valid maximum amount but rejects a resulting balance overflow', () => {
  assert.deepEqual(parseAmount('999999.99'), { cents: 99999999 });
  assertAppOutput(['2', '999999.99', '1', '4'], [
    'Credit would exceed the maximum balance of 999999.99.',
    'Current balance: 001000.00',
  ], ['Amount credited.']);
});

test('INPUT-07: rejects alphabetic and blank debit inputs without changing the balance', () => {
  const output = assertAppOutput(['3', 'abc', '3', '', '1', '4'], [
    'Invalid amount.',
    'Current balance: 001000.00',
  ], ['Amount debited.']);
  assert.equal((output.match(/Invalid amount\./g) || []).length, 2);
});

test('INPUT-08: rejects debit input with more than two fractional digits', () => {
  assertAppOutput(['3', '0.019', '1', '4'], [
    'Invalid amount.',
    'Current balance: 001000.00',
  ], ['Amount debited.']);
});

test('INPUT-09: rejects an over-balance debit and preserves the balance', () => {
  assertAppOutput(['3', '999999.99', '1', '4'], [
    'Insufficient funds for this debit.',
    'Current balance: 001000.00',
  ], ['Amount debited.']);
});

test('LIMIT-01: reaches the maximum representable balance exactly', () => {
  assertAppOutput(['2', '998999.90', '2', '0.09', '1', '4'], [
    'Amount credited. New balance: 999999.90',
    'Amount credited. New balance: 999999.99',
    'Current balance: 999999.99',
  ]);
});

test('LIMIT-02: rejects a credit above the maximum instead of wrapping to zero', () => {
  assertAppOutput(['2', '998999.90', '2', '0.09', '2', '0.01', '1', '4'], [
    'Amount credited. New balance: 999999.90',
    'Amount credited. New balance: 999999.99',
    'Credit would exceed the maximum balance of 999999.99.',
    'Current balance: 999999.99',
  ], ['New balance: 000000.00']);
});

test('DATA-01: a new account returns the initial stored balance', () => {
  const account = createAccount();
  assert.equal(account.getBalance(), 100000);
  assert.equal(formatBalance(account.getBalance()), '001000.00');
});

test('DATA-02: account updates are returned by subsequent reads', () => {
  const account = createAccount();
  assert.deepEqual(account.credit(1234), { balance: 101234 });
  assert.equal(account.getBalance(), 101234);
  assert.deepEqual(account.debit(234), { balance: 101000 });
  assert.equal(formatBalance(account.getBalance()), '001010.00');
});

test('DATA-03: unsupported menu input cannot mutate the account', () => {
  assertAppOutput(['8', '1', '4'], [
    'Invalid choice, please select 1-4.',
    'Current balance: 001000.00',
  ], ['Enter credit amount:', 'Enter debit amount:']);
});

test('OPS-01: unsupported menu input produces no account operation', () => {
  assertAppOutput(['8', '1', '4'], [
    'Invalid choice, please select 1-4.',
    'Current balance: 001000.00',
  ], ['Enter credit amount:', 'Enter debit amount:', 'Amount credited.', 'Amount debited.']);
});

test('end of input before an explicit exit reports an error', () => {
  const menu = runApp([]);
  assert.equal(menu.status, 1);
  assert.match(menu.stderr, /Input ended before the application was exited\./);
  const amount = runApp(['2']);
  assert.equal(amount.status, 1);
  assert.match(amount.stderr, /Input ended before an amount was entered\./);
});
