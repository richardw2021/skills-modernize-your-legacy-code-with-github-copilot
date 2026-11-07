# Account management test plan

## Purpose and execution

This plan describes the **current COBOL behavior**, not a proposed banking
policy. Business stakeholders should review the results and decide which
behaviors the Node.js implementation must preserve or deliberately change.
In particular, unsigned input handling, truncation, overflow, zero-value
transactions, and non-persistence need review.

The source of truth is [main.cob](../src/cobol/main.cob),
[operations.cob](../src/cobol/operations.cob), and
[data.cob](../src/cobol/data.cob). The examples below were characterized with
GnuCOBOL 3.1.2.0; input conversion can depend on the COBOL runtime and should
be rechecked if the environment changes. The plan itself is not a record of
stakeholder execution: record observed results, pass/fail, and decisions in
the last three columns.

Compile and start the application from the repository root:

```sh
cobc -x src/cobol/main.cob src/cobol/operations.cob src/cobol/data.cob -o accountsystem
./accountsystem
```

Unless stated otherwise, start a **fresh process** for each case. Each input
is a separate line followed by Enter; `1`, `2`, `3`, and `4` mean the menu
choices for view, credit, debit, and exit. A fresh process starts with one
shared balance of `1000.00`. Balances displayed by this runtime have six
integer digits and two decimal digits. The interface-level cases require a
test harness that calls the COBOL subprograms in one process; they are not
accessible directly through the menu.

The application has no student identifiers, multiple accounts, transaction
history, or persistent account storage. A change to any of these is a new
requirement rather than existing behavior. For future Node.js tests, compare
the business result as well as the visible messages where compatibility is
required; preserve or change the unusual cases only after stakeholder review.

## Node.js migration test coverage

Run the dedicated Node.js tests from `src/accounting` with `npm test`. The
`index.test.js` suite uses the case IDs below to cover the menu, transactions,
in-memory balance, input handling, and balance limits. The Node.js application
intentionally rejects negative, blank, nonnumeric, and over-precision amounts,
rejects multi-digit menu choices, and rejects balance overflow; tests assert
these safer behaviors rather than the COBOL runtime conversions and wraparound
recorded in MENU-05, INPUT-01 through INPUT-08, and LIMIT-02. DATA-03 and OPS-01
describe internal COBOL subprogram calls that are not public interfaces in the
consolidated Node.js application; their Node tests cover invalid menu choices
not mutating the account, rather than introducing equivalent subprogram APIs.

## Test cases

| Test Case ID | Test Case Description | Pre-conditions | Test Steps | Expected Result | Actual Result | Status (Pass/Fail) | Comments |
|---|---|---|---|---|---|---|---|
| MENU-01 | Show the menu and initial balance | Fresh process | Start the app; enter `1`. | Menu shows Account Management System, options 1 View Balance, 2 Credit Account, 3 Debit Account, and 4 Exit. The prompt requests a choice from 1–4. Output is `Current balance: 001000.00`; the menu returns. | — | Not run | Confirm initial balance and display format. |
| MENU-02 | Exit without a transaction | Fresh process | Enter `4`. | Output is `Exiting the program. Goodbye!`; the process terminates without another menu. | — | Not run | |
| MENU-03 | Reject an unsupported menu digit | Fresh process | Enter `9`, then `1`, then `4`. | Output includes `Invalid choice, please select 1-4.`; the menu returns, and the balance remains `001000.00`. | — | Not run | |
| MENU-04 | Handle nonnumeric and blank menu input | Fresh process | Enter `a`; submit an empty line; enter `1`, then `4`. | Each invalid selection displays `Invalid choice, please select 1-4.` and returns to the menu; balance remains `001000.00`. | — | Not run | Runtime-specific input conversion. |
| MENU-05 | Handle a multi-digit menu selection | Fresh process | Enter `12`, then `4`. | The one-character choice field receives `1`: output includes `Current balance: 001000.00`, then the menu returns. | — | Not run | Runtime-specific truncation; confirm desired validation. |
| VIEW-01 | Repeated balance inquiries do not change balance | Fresh process | Enter `1` twice, then `4`. | Both inquiries show `Current balance: 001000.00`. | — | Not run | |
| CREDIT-01 | Credit a decimal amount | Fresh process | Enter `2`, enter `12.34`, enter `1`, then `4`. | Credit prompt is `Enter credit amount:`. Output is `Amount credited. New balance: 001012.34`; subsequent inquiry shows `001012.34`. | — | Not run | |
| CREDIT-02 | Credit an integer amount | Fresh process | Enter `2`, enter `10`, enter `1`, then `4`. | Credit succeeds with balance `001010.00`; the inquiry shows the same balance. | — | Not run | |
| CREDIT-03 | Credit zero | Fresh process | Enter `2`, enter `0`, enter `1`, then `4`. | Output reports a successful credit and balance `001000.00`; the inquiry shows the same balance. | — | Not run | Confirm whether zero should be accepted. |
| CREDIT-04 | Credit one cent | Fresh process | Enter `2`, enter `0.01`, enter `1`, then `4`. | Credit succeeds with balance `001000.01`; the inquiry shows the same balance. | — | Not run | |
| DEBIT-01 | Debit less than the balance | Fresh process | Enter `3`, enter `12.34`, enter `1`, then `4`. | Debit prompt is `Enter debit amount:`. Output is `Amount debited. New balance: 000987.66`; the inquiry shows `000987.66`. | — | Not run | |
| DEBIT-02 | Debit the entire balance | Fresh process | Enter `3`, enter `1000.00`, enter `1`, then `4`. | Debit succeeds because the amount equals the balance; the new and queried balance is `000000.00`. | — | Not run | |
| DEBIT-03 | Reject a debit one cent above the balance | Fresh process | Enter `3`, enter `1000.01`, enter `1`, then `4`. | Output is `Insufficient funds for this debit.`; inquiry shows unchanged balance `001000.00`. No debit-success message is displayed. | — | Not run | |
| DEBIT-04 | Debit zero | Fresh process | Enter `3`, enter `0`, enter `1`, then `4`. | Output reports a successful debit and balance `001000.00`; the inquiry shows the same balance. | — | Not run | Confirm whether zero should be accepted. |
| DEBIT-05 | Debit against a zero balance | Fresh process | Debit `1000.00`; debit `0`; debit `0.01`; view balance; exit. | First debit reaches `000000.00`; zero debit succeeds; the one-cent debit is rejected for insufficient funds; balance remains `000000.00`. | — | Not run | |
| FLOW-01 | Combine credits and debits in one session | Fresh process | Credit `100.00`; debit `25.50`; credit `0.01`; view balance; exit. | Successive balances are `001100.00`, `001074.50`, and `001074.51`; inquiry shows `001074.51`. The menu returns after each operation. | — | Not run | Verifies that all operations use the same stored balance. |
| FLOW-02 | Continue after a rejected debit | Fresh process | Debit `1000.01`; debit `1.00`; view balance; exit. | First debit is rejected; second succeeds with `000999.00`; inquiry shows `000999.00`. | — | Not run | |
| FLOW-03 | Restart resets the account | Fresh process | Credit `10`; exit; start a new process; view balance; exit. | First session reports `001010.00`. The new process reports `001000.00`: the credit was not persisted. | — | Not run | Confirm whether persistence is required in Node.js. |
| INPUT-01 | Negative credit input | Fresh process | Credit `-1.00`; view balance; exit. | With the characterized runtime the unsigned field treats the amount as `1.00`: credit succeeds and balance is `001001.00`. | — | Not run | Not negative-amount validation; confirm desired behavior. |
| INPUT-02 | Negative debit input | Fresh process | Debit `-1.00`; view balance; exit. | With the characterized runtime the unsigned field treats the amount as `1.00`: debit succeeds and balance is `000999.00`. | — | Not run | Confirm desired behavior. |
| INPUT-03 | Alphabetic credit input | Fresh process | Credit `abc`; view balance; exit. | With the characterized runtime the amount is treated as zero: a successful credit is reported and the balance remains `001000.00`. | — | Not run | No explicit input validation; do not generalize to every malformed string. |
| INPUT-04 | Blank credit input | Fresh process | Select credit, submit an empty line, view balance, and exit. | With the characterized runtime the amount is treated as zero: a successful credit is reported and the balance remains `001000.00`. | — | Not run | Confirm desired behavior. |
| INPUT-05 | More than two fractional digits | Fresh process | Credit `0.019`; view balance; exit. | With the characterized runtime the amount is truncated to `0.01`; balance is `001000.01`, not rounded up. | — | Not run | Confirm desired precision and rounding. |
| INPUT-06 | Input longer than the amount field | Fresh process | Credit `999999.99`; view balance; exit. | With the characterized runtime the input is truncated to `999999.9`, interpreted as `999999.90`; the resulting overflowed balance is `000999.90` and is retained for inquiry. | — | Not run | The input field is eight characters; the decimal point also consumes an input character. Confirm desired limits. |
| INPUT-07 | Alphabetic and blank debit inputs | Fresh process | Debit `abc`; select debit again and submit an empty line; view balance; exit. | With the characterized runtime both amounts are treated as zero: both debits report success and the balance remains `001000.00`. | — | Not run | Confirm desired behavior. |
| INPUT-08 | Debit with more than two fractional digits | Fresh process | Debit `0.019`; view balance; exit. | With the characterized runtime the amount is truncated to `0.01`; the debit succeeds with balance `000999.99`. | — | Not run | Confirm desired precision and rounding. |
| INPUT-09 | Debit with input longer than the amount field | Fresh process | Debit `999999.99`; view balance; exit. | With the characterized runtime the amount is interpreted as `999999.90`, which exceeds the balance; the debit is rejected and balance remains `001000.00`. | — | Not run | Confirm desired input limits. |
| LIMIT-01 | Reach the maximum representable balance | Fresh process | Credit `998999.9`; credit `0.09`; view balance; exit. | Successive balances are `999999.90` and `999999.99`; inquiry shows `999999.99`. | — | Not run | `PIC 9(6)V99` has six integer and two fractional digits. |
| LIMIT-02 | Credit beyond the representable balance | Fresh process | Credit `998999.9`; credit `0.09`; credit `0.01`; view balance; exit. | With the characterized runtime the last credit reports success and the balance wraps from `999999.99` to `000000.00`; inquiry shows `000000.00`. | — | Not run | No size-error handling; confirm whether overflow should instead be rejected. |
| DATA-01 | Read the initial stored balance | Fresh process with a harness calling `DataProgram` | Call `READ` with a caller balance initialized to `42.00`. | The caller's balance is replaced with `1000.00`; stored balance is unchanged. | — | Not run | Interface/unit test. |
| DATA-02 | Write and read a balance | Fresh process with a harness calling `DataProgram` | Call `WRITE` with `123.45`; call `READ` using a separate caller field initialized to `0.00`. | The read returns `123.45`; writing replaces the single stored balance. | — | Not run | Calls must share the same process. |
| DATA-03 | Ignore an unsupported storage operation | Fresh process with a harness calling `DataProgram` | Write `123.45`; call an unsupported operation such as `OTHER` with caller balance `55.00`; then read the balance into another field. | Unsupported operation leaves caller balance at `55.00` and stored balance at `123.45`; no message is produced. | — | Not run | Existing internal behavior, not a menu option. |
| OPS-01 | Ignore an unsupported account operation | Fresh process with a harness calling `Operations` and `DataProgram` | Call `Operations` with an unsupported operation such as `OTHER`; then read the balance through `DataProgram`. | No transaction prompt or result is produced; stored balance remains `1000.00`. | — | Not run | Existing internal behavior, not a menu option. |
