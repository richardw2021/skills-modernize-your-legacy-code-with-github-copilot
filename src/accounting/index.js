'use strict';

const readline = require('node:readline');

const INITIAL_BALANCE = 100000;
const MAX_BALANCE = 99999999;

function parseAmount(input) {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    return { error: 'Invalid amount. Enter a non-negative number with at most two decimal places.' };
  }

  const [whole, fraction = ''] = value.split('.');
  const normalizedWhole = whole.replace(/^0+/, '') || '0';
  if (normalizedWhole.length > 6) {
    return { error: 'Amount cannot exceed 999999.99.' };
  }
  const cents = Number(normalizedWhole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents > MAX_BALANCE) {
    return { error: 'Amount cannot exceed 999999.99.' };
  }
  return { cents };
}

function formatBalance(cents) {
  const whole = Math.floor(cents / 100).toString().padStart(6, '0');
  const fraction = (cents % 100).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

function createAccount() {
  let balance = INITIAL_BALANCE;

  function validateCents(cents) {
    if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_BALANCE) {
      throw new RangeError('Amount must be an integer number of cents between 0 and 99999999.');
    }
  }

  return {
    getBalance() {
      return balance;
    },
    credit(cents) {
      validateCents(cents);
      if (balance + cents > MAX_BALANCE) {
        return { error: 'Credit would exceed the maximum balance of 999999.99.' };
      }
      balance += cents;
      return { balance };
    },
    debit(cents) {
      validateCents(cents);
      if (cents > balance) {
        return { error: 'Insufficient funds for this debit.' };
      }
      balance -= cents;
      return { balance };
    },
  };
}

async function run() {
  const account = createAccount();
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const lines = input[Symbol.asyncIterator]();

  async function readLine(prompt) {
    console.log(prompt);
    const next = await lines.next();
    return next.done ? null : next.value;
  }

  try {
    while (true) {
      console.log('--------------------------------');
      console.log('Account Management System');
      console.log('1. View Balance');
      console.log('2. Credit Account');
      console.log('3. Debit Account');
      console.log('4. Exit');
      console.log('--------------------------------');
      const choice = await readLine('Enter your choice (1-4): ');
      if (choice === null) {
        console.error('Input ended before the application was exited.');
        process.exitCode = 1;
        return;
      }

      switch (choice.trim()) {
        case '1':
          console.log(`Current balance: ${formatBalance(account.getBalance())}`);
          break;
        case '2':
        case '3': {
          const isCredit = choice.trim() === '2';
          const amount = await readLine(isCredit ? 'Enter credit amount: ' : 'Enter debit amount: ');
          if (amount === null) {
            console.error('Input ended before an amount was entered.');
            process.exitCode = 1;
            return;
          }
          const parsed = parseAmount(amount);
          if (parsed.error) {
            console.log(parsed.error);
            break;
          }
          const result = isCredit ? account.credit(parsed.cents) : account.debit(parsed.cents);
          if (result.error) {
            console.log(result.error);
          } else {
            const verb = isCredit ? 'credited' : 'debited';
            console.log(`Amount ${verb}. New balance: ${formatBalance(result.balance)}`);
          }
          break;
        }
        case '4':
          console.log('Exiting the program. Goodbye!');
          return;
        default:
          console.log('Invalid choice, please select 1-4.');
      }
    }
  } finally {
    input.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error('Application error:', error);
    process.exitCode = 1;
  });
}

module.exports = { createAccount, formatBalance, parseAmount };
