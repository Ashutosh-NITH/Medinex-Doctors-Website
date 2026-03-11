# MediNex — Doctor Web Portal

> A blockchain-powered medical records platform where doctors can securely access, verify, and digitally sign patient reports using end-to-end encryption on the Aptos blockchain.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
  - [Cryptography Architecture](#cryptography-architecture)
  - [Authentication Flow](#authentication-flow)
  - [State Medical Council DB](#state-medical-council-db)
  - [Report Access Flow](#report-access-flow)
  - [Digital Signature Flow](#digital-signature-flow)
- [Smart Contracts](#smart-contracts)
- [Environment Variables](#environment-variables)
  - [Frontend `.env`](#frontend-env)
  - [Backend `.env`](#backend-env)
- [Running the Project](#running-the-project)
- [Related Projects](#related-projects)

---

## Overview

MediNex is a decentralized medical records system. Patients store their encrypted medical reports on IPFS, with access control managed on the Aptos blockchain. Doctors log in via their NMR (National Medical Register) ID, which is verified against a State Medical Council database before being registered on-chain.

Key properties:
- **No central server holds medical data** — reports live on IPFS, encrypted
- **End-to-end encrypted** — only the patient (and doctors they grant access to) can decrypt reports
- **Blockchain-verified identities** — doctors are verified against council records before registration
- **Digital signatures** — doctors can cryptographically sign reports, signatures stored on-chain and verifiable by anyone

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (State Medical Council registry) |
| Blockchain | Aptos (Testnet) — Move smart contracts |
| Storage | IPFS via Pinata |
| OTP / SMS | Twilio |
| Crypto | `@noble/curves` (Ed25519), `@noble/hashes` (SHA-256), X25519 ECDH |
| Wallet | BIP39 mnemonic → Aptos Ed25519 keypair |

---

## Project Structure

```
MediNex Website/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx       # Marketing / home page
│   │   │   ├── AuthPage.tsx          # Login + registration flow
│   │   │   └── DashboardPage.tsx     # Main doctor dashboard
│   │   ├── services/
│   │   │   ├── aptos.ts              # All blockchain interactions
│   │   │   ├── crypto.ts             # Key derivation, ECDH, encryption
│   │   │   ├── ipfs.ts               # Pinata / IPFS fetch helpers
│   │   │   └── api.ts                # Backend API calls (NMR check, OTP)
│   │   ├── store/
│   │   │   └── authStore.ts          # Zustand session store (persisted)
│   │   └── types/
│   │       └── index.ts              # Shared TypeScript types
│   ├── .env                          # Frontend environment variables
│   ├── vite.config.ts                # Proxy /api → localhost:4000
│   └── package.json
└── backend/
    ├── src/
    │   └── index.ts                  # Express API server
    ├── .env                          # Backend environment variables
    └── package.json
```

---

## How It Works

### Cryptography Architecture

Each doctor has **two keypairs** derived from a single 12-word BIP39 mnemonic:

```
Mnemonic (12 words)
├── → Aptos Ed25519 keypair     (blockchain transactions + digital signatures)
└── → PBKDF2-HMAC-SHA256        (X25519 keypair for ECDH encryption)
```

**Report decryption:**
```
ECDH(doctorPrivateKey × patientPublicKey)
  → shared secret
  → unwrap AES key (stored encrypted on IPFS per-report)
  → decrypt report file
```

**Digital signatures:**
```
SHA-256(reportCID)
  → Ed25519.sign(hash, aptosPrivateKey)
  → signature + pubkey stored on blockchain
```

Verification is permissionless — anyone with the doctor's public key and the CID can verify the signature.

---

### Authentication Flow

There are three paths depending on the doctor's registration status:

```
Doctor enters NMR ID
        │
        ▼
[1] isNMRIDRegister(CONTRACT, nmrId)  ← blockchain view call
        │
   ┌────┴────┐
   │         │
  TRUE      FALSE
   │         │
   │    [2] backend /api/auth/check-nmr
   │         │
   │    ┌────┴────────────┐
   │    │                 │
   │  council_       not_found
   │  registered          │
   │    │           "Unauthorised Doctor"
   │    ▼                 (stop here)
   │  Send OTP via Twilio SMS
   │    │
   │    ▼
   │  Doctor enters 6-digit OTP
   │    │
   │    ▼
   │  Wallet Setup
   │  ├── Generate new 12-word mnemonic
   │  └── Import existing mnemonic
   │    │
   │    ▼
   │  isDoctorRegistered(walletAddress)  ← guard against double-registration
   │    │
   │  FALSE → initDoctorAccessStore() + registerDoctor()  [on-chain]
   │  TRUE  → skip (wallet already registered, just log in)
   │    │
   └────┤
        ▼
   Enter mnemonic → isDoctorRegistered(walletAddress)
        │
      TRUE  → derive keypairs → set session → Dashboard ✅
      FALSE → "Mnemonic does not match registered wallet" ❌
```

**Session data stored in localStorage (Zustand persist):**

| Field | Description |
|---|---|
| `walletAddress` | Aptos wallet address |
| `nmrId` | Doctor's NMR ID |
| `mnemonic` | 12-word BIP39 mnemonic |
| `cryptoPrivateKey` | X25519 private key (base64) |
| `cryptoPublicKey` | X25519 public key (base64) |
| `name` | Doctor's name |
| `council` | State Medical Council name |
| `speciality` | Medical speciality |
| `regYear` | Year of registration |
| `qualifyYear` | Year of qualification |

> ⚠️ The mnemonic is stored in browser localStorage. In production, consider prompting for it on each login rather than persisting it.

---

### State Medical Council DB

The backend maintains a PostgreSQL table `state_medical_council` that acts as the authoritative list of verified doctors. This simulates a national/state medical council registry — only doctors in this table can register on MediNex.

**Schema:**
```sql
CREATE TABLE state_medical_council (
  id                  SERIAL PRIMARY KEY,
  nmr_id              VARCHAR(100) UNIQUE NOT NULL,  -- e.g. "AS-2024-00001"
  name                VARCHAR(200) NOT NULL,
  phone               VARCHAR(20)  NOT NULL,          -- receives OTP via Twilio
  council             VARCHAR(200),                   -- e.g. "Himachal Pradesh Medical Council"
  speciality          VARCHAR(200),
  reg_year            VARCHAR(10),
  qualify_year        VARCHAR(10),
  registration_number INT,
  is_active           BOOLEAN DEFAULT true
);
```

**NMR ID format:** `{STATE_CODE}-{YEAR}-{SEQUENCE}` e.g. `AS-2024-00001`, `MH-2024-00001`

**To add a new doctor to the system:**
```sql
INSERT INTO state_medical_council
  (nmr_id, name, phone, council, speciality, reg_year, qualify_year, registration_number)
VALUES
  ('XX-2024-00001', 'Dr. Full Name', '+91XXXXXXXXXX',
   'State Medical Council Name', 'Speciality', '2024', '2022', 200001);
```

The backend `/api/auth/check-nmr` endpoint:
- Looks up the NMR ID in this table
- Returns `council_registered` if found (frontend proceeds to OTP)
- Returns `not_found` if not found (frontend shows "Unauthorised Doctor")

---

### Report Access Flow

```
Patient uploads report
  → file encrypted with AES-256-GCM key
  → AES key encrypted with patient's X25519 public key (self-share)
  → { encryptedAESKey, encryptedFile } uploaded to IPFS → CID stored on blockchain

Doctor requests access
  → requestAccess(patientAddress, reportId, doctorCryptoPublicKey)
  → patient app sees the pending request

Patient grants access
  → ECDH(patientPrivKey × doctorPubKey) → shared secret
  → re-encrypt AES key for doctor using shared secret
  → grantAccess(doctorAddress, reportId, encryptedAESKeyForDoctor)

Doctor opens report
  → getEncryptedKey(doctorAddress, reportId)
  → ECDH(doctorPrivKey × patientPubKey) → same shared secret
  → unwrap AES key → decrypt file → download
```

The report CID **never changes** regardless of how many doctors are granted access.

---

### Digital Signature Flow

```
Patient requests signature (from patient app)
  → requestSignature(doctorAddress, reportId)  [on-chain tx]

Doctor sees pending requests in Signatures tab
  → hash = SHA-256(reportCID)
  → signature = Ed25519.sign(hash, aptosPrivateKey)
  → signReport(reportId, cid, base64(signature), base64(pubkey))  [on-chain tx]
  OR
  → declineSignature(reportId, patientAddress)  [on-chain tx]

Patient sees "Digitally Signed" badge on report card (auto-checked on load)

Anyone can verify independently
  → getSignatures(reportId) → [{ doctor_address, doctor_pubkey, signature, report_cid, signed_at }]
  → hash = SHA-256(reportCID)
  → Ed25519.verify(signature, hash, doctorPubkey) → true / false
```

Multiple doctors can sign the same report. Each signature is stored independently on-chain.

---

## Smart Contracts

All contracts are deployed under the `MediNex` namespace on Aptos Testnet.

| Contract | Purpose |
|---|---|
| `DoctorRegistryContract` | Doctor identity, NMR ID → wallet address mapping |
| `PatientRegistryContract` | Patient identity + IPFS profile CID |
| `PatientReportsContract` | Report metadata (CID, uploadedAt) indexed by report ID |
| `ReportAccessContract` | Per-doctor encrypted AES keys, access request tracking |
| `ReportSignatureContract` | Signature requests and completed signatures per report |

**Important:** All `public fun` read functions **must** have the `#[view]` attribute. Without it, the Aptos SDK will throw `'...' is not a view function`. Example:

```move
#[view]
public fun isNMRIDRegister(registry_owner: address, nmr: String): bool { ... }

#[view]
public fun isDoctorRegistered(doctor_address: address): bool { ... }
```

**After deploying, run these init functions once:**
```bash
aptos move publish --named-addresses MediNex=YOUR_ADDRESS

aptos move run --function-id YOUR_ADDRESS::DoctorRegistryContract::initRegistry
aptos move run --function-id YOUR_ADDRESS::ReportSignatureContract::initSignatureStore
```

> `initDoctorAccessStore` and patient equivalents are called per-user automatically during registration.

---

## Environment Variables

### Frontend `.env`

Create a file at `frontend/.env`:

```env
# ── Aptos Blockchain ──────────────────────────────────────────────────────────
# Your deployed contract address on Aptos Testnet
# Run: aptos move publish --named-addresses MediNex=YOUR_ADDRESS
VITE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000000000000000000000000000

# ── Pinata IPFS ───────────────────────────────────────────────────────────────
# Sign up at https://app.pinata.cloud → API Keys → Create New Key
# Required permissions: pinFileToIPFS, pinJSONToIPFS
VITE_PINATA_API_KEY=your_pinata_api_key_here
VITE_PINATA_SECRET_API_KEY=your_pinata_secret_api_key_here
VITE_PINATA_GATEWAY=https://gateway.pinata.cloud
```

> All frontend environment variables **must** be prefixed with `VITE_` to be exposed to the browser by Vite.

---

### Backend `.env`

Create a file at `backend/.env`:

```env
# ── Server ────────────────────────────────────────────────────────────────────
PORT=4000
# URL of the running frontend (used for CORS)
FRONTEND_URL=http://localhost:5173

# ── PostgreSQL ────────────────────────────────────────────────────────────────
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
# Create the database first: CREATE DATABASE medinex;
MONGODB_URI=mongodb+srv:

# ── Twilio (OTP via SMS) ──────────────────────────────────────────────────────
# Sign up at https://console.twilio.com
# Account SID and Auth Token from the Twilio Console dashboard
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
# A Twilio phone number you own (with SMS capability)
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

# ── Aptos Blockchain ──────────────────────────────────────────────────────────
# Same contract address as VITE_CONTRACT_ADDRESS in the frontend
CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000000000000000000000000000

# ── Aptos Node (optional) ────────────────────────────────────────────────────
# Defaults to Aptos Testnet if not set
APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
```

---

## Running the Project

**Prerequisites:**
- Node.js v18+
- PostgreSQL 14+
- Aptos CLI (for contract deployment)
- Twilio account with a phone number
- Pinata account

**1. Install dependencies:**
```powershell
# Backend
cd "MediNex Website\backend"
npm install

# Frontend
cd "MediNex Website\frontend"
npm install
```

**2. Set up both `.env` files** as described above.

**3. Start both servers (two terminals):**
```powershell
# Terminal 1 — Backend API (port 4000)
cd "MediNex Website\backend"
npm run dev

# Terminal 2 — Frontend (port 5173)
cd "MediNex Website\frontend"
npm run dev
```

**4. Open** `http://localhost:5173`

---


**4. OTP rate limiting:** 5 requests per 10 minutes per IP (enforced by `express-rate-limit`).

---

## Related Projects

| Project | Description |
|---|---|
| **Patient App** | Flutter mobile app — patients upload reports, grant doctor access, request digital signatures |
| **MediNex Contracts** | Move smart contracts source — `github.com/Ashutosh-NITH/medinex-contracts` |

---

## Additional Notes

- The project targets **Aptos Testnet**. To switch to Mainnet, change `Network.TESTNET` → `Network.MAINNET` in `frontend/src/services/aptos.ts` and update `APTOS_NODE_URL`.
- IPFS files are **permanent and immutable** — once a report CID is on-chain, the encrypted file at that CID cannot be altered.
- Clearing browser storage (`localStorage.removeItem('medinex-auth')`) will log the doctor out. They will need to re-enter their mnemonic to log back in.
- The `initDoctorStore` call in `completeRegistration` is idempotent (it catches errors silently) — safe to call even if the store already exists. remove postgre sql  setup part 
