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
