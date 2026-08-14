# crypto-wallet

Self-custodial Ethereum wallet. Your keys, your coins — on iOS, Android and web.

Most wallets show you what you are signing. This one is built to tell you what you are risking, before you sign it, and what the trade actually cost you, after it lands.

|                                 |                                   |
| ------------------------------- | --------------------------------- |
| ![Wallet](assets/screens/5.png) | ![Explore](assets/screens/4.jpg)  |
| ![Swap](assets/screens/2.png)   | ![Activity](assets/screens/3.png) |

## Features

### Wallet

- Create and import self-custodial EVM wallets using a recovery phrase
- Manage multiple wallets and switch between active accounts
- Send native tokens and ERC-20 tokens
- View token balances and portfolio value
- Swap tokens through Uniswap
- Track wallet activity and transaction status
- Reveal the recovery phrase and the private key of the active wallet, behind a second PIN prompt

### Security

- **Encrypted local vault** — recovery phrases are encrypted with per-wallet keys and protected by a device-bound master key and PIN-derived authentication
- PIN protection with scrypt-based key derivation and automatic locking
- **Transaction Firewall** — validates transfers, token approvals and swaps before signing
- Configurable limits for:
  - maximum transaction value
  - first transfer to a new recipient
  - daily outflow
  - token approval exposure
  - swap loss exposure
- **Security briefing at the moment of signing** — every confirmation screen states what was checked, what was not, and why, instead of only speaking up to refuse
- **Permission Graph** — scans ERC-20 and Permit2 permissions and shows which contracts can access wallet assets
- **Asset exposure / blast radius** — estimates how much value is currently exposed through active permissions
- One-tap approval revoke for supported ERC-20 and Permit2 permissions
- Blocks unlimited approvals and unknown spenders
- **Emergency Freeze** — disables all signing on the device for 24 hours and cannot be cancelled early with the PIN
- Strict transaction verification before signing, including transaction-field validation, signer recovery and canonical encoding checks

### Swap Protection

- Exact-amount token approvals instead of unlimited approvals
- Known-router enforcement
- Minimum-output validation
- Swap deadline validation
- Expired and excessively long-lived swap transactions are rejected before signing

### Honest accounting

- **Execution report** — after a swap, what was quoted, the minimum accepted, what actually arrived, the gap between quote and reality, the network fee and the time to confirm
- Quoted amounts and received amounts are separate facts and are never shown as one another
- Amounts that arrived are decoded from the transaction receipt, not from the pre-trade quote
- A portfolio total that cannot be fully valued says so instead of quietly reporting a smaller number
- Transfers between your own addresses are recorded as such, not as money leaving the wallet
- Recipients are only recognised from transfers this wallet signed, so a planted token-transfer log cannot make an unknown address look familiar

### Platform

- React Native / Expo
- Ethereum Mainnet and Sepolia support
- Platform-independent wallet core designed for future browser-extension and web adapters

## Architecture

The wallet is split into a pure core and platform adapters:

```text
src/core        pure TypeScript: crypto, policy, transaction building, ledger facts
src/platform    React Native / Expo adapters: storage, keychain, RPC, signing
src/app         expo-router screens
src/components  UI
```

`src/core` never imports React Native, Expo, `window`, `document` or `localStorage`. `npm run test:core` loads every core module in plain Node and runs the full check suite there, which is what keeps the boundary honest and the core reusable by a future browser extension.

## Development

```bash
npm install
npm start
```

```bash
npm run test:core    # runs the whole core suite in plain Node
npx tsc --noEmit     # type check
npx eslint src       # lint
```

Set `EXPO_PUBLIC_ALCHEMY_API_KEY` in `.env` before starting; the app refuses to boot without it.
