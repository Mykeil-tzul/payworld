# PayWorld · Interactive Card Payments Lab

**[Open the live simulator](https://mykeil-tzul.github.io/payworld/)**

I’m Myke. I’ve worked at Visa for over a year and wanted to show what I’ve learned about the four-party model through an everyday purchase. In this demo I tap to pay for a $5.75 vanilla cappuccino at Harbor Café, a fictional merchant. You can change the amount or follow an approval, decline, timeout, duplicate request, or refund.

## Who does what?

| Party | Role in the example |
| --- | --- |
| Cardholder | Myke uses the payment credential issued by his bank. |
| Merchant | Harbor Café accepts the payment and submits the purchase. |
| Acquirer | The acquiring side supports merchant acceptance and connects the merchant to the network, often using a processor. |
| Issuer | The bank that issued the card manages the account and ordinarily makes the authorization decision. |
| **Visa network** | Visa connects the issuing and acquiring sides, routes messages, and supports clearing and settlement. The network is shown separately from the four parties. |

Visa can also respond on an issuer’s behalf in some circumstances. The demo models the normal issuer-decision path. [Visa Developer](https://developer.visa.com/docs/visanet-connect-acceptance) · [Visa card-processing overview](https://www.visa.com/en-us/personal/cards/how-do-credit-cards-work)

## Try the five scenarios

- **Approved.** Follow the request to the issuer and back, then capture, clear, and settle the purchase. The ledger changes only when the modeled accounting events occur.
- **Declined.** See how the response returns through the network and stops the flow.
- **Timeout.** The issuer approves, but the merchant misses the response. Resolve the original payment to recover the result.
- **Duplicate.** A repeat with the same operation key reuses the stored result. Conflicting commands with the same key are rejected. No new issuer request or ledger entry is created.
- **Refund.** Settle the sale, submit a full refund, and watch the simulated merchant cash reconciliation return to zero.

After settlement, try **Redeliver settlement webhook**. It illustrates a common design where a payment service retries a notification and the recipient deduplicates by event ID. It's a fictional payment-service notification, not a Visa webhook contract.

## Engineering notes

The transaction engine is separate from the UI. An explicit state machine controls available operations and creates ordered events. Money uses integer cents. The toy merchant ledger shows equal debit and credit amounts, separate from authorization messages. Expected merchant cash and recorded cash are reconciled as a simple invariant.

The app is a static, browser-only educational simulation. It does not connect to Visa, a bank, or a payment-provider sandbox. It has no credential form, card numbers, employee systems, confidential data, or real payments. Real systems require durable idempotency, signed webhooks, authentication, separate ledgers and settlement files, reconciliation processes, and more complex error recovery. The coffee shop and account decisions are fictional. Fees, netting, disputes and stand-in processing are outside the example.

PayWorld is an independent portfolio project. The [Visa wordmark](https://commons.wikimedia.org/wiki/File:Visa_2021.svg) is used to identify the network and belongs to Visa.

## Run locally

```sh
python3 -m http.server 8000 --directory site
node --test tests/*.test.mjs
```

Open `http://localhost:8000`. GitHub Actions runs the scenario tests before publishing the static site.
