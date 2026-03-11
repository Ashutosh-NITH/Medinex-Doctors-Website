import { pbkdf2 } from '@noble/hashes/pbkdf2'
import { sha256 } from '@noble/hashes/sha256'
import { x25519 } from '@noble/curves/ed25519'
import { gcm } from '@noble/ciphers/aes'

const SALT = new TextEncoder().encode('PATIENT_X25519_KEY_DERIVE_USING_MNEMONICS')

export function deriveKeyPair(mnemonic: string) {
  const seed = pbkdf2(sha256, new TextEncoder().encode(mnemonic), SALT, { c: 150000, dkLen: 32 })
  return { privateKey: seed, publicKey: x25519.getPublicKey(seed) }
}

export const toB64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b))
export const fromB64 = (s: string): Uint8Array => new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0)))

export function ecdh(priv: Uint8Array, pub: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(priv, pub)
}

export function unwrapAesKey(wrapped: { ciphertext: string; nonce: string; mac: string }, sharedKey: Uint8Array): Uint8Array {
  const nonce = fromB64(wrapped.nonce)
  const ct    = fromB64(wrapped.ciphertext)
  const mac   = fromB64(wrapped.mac)
  const combined = new Uint8Array(ct.length + mac.length)
  combined.set(ct); combined.set(mac, ct.length)
  return gcm(sharedKey, nonce).decrypt(combined)
}

export async function decryptFile(encrypted: Uint8Array, aesKey: Uint8Array): Promise<Uint8Array> {
  const nonce = encrypted.slice(0, 12)
  const mac   = encrypted.slice(12, 28)
  const ct    = encrypted.slice(28)
  const combined = new Uint8Array(ct.length + mac.length)
  combined.set(ct); combined.set(mac, ct.length)
  return gcm(aesKey, nonce).decrypt(combined)
}

export function detectExt(bytes: Uint8Array): string {
  if (bytes[0] === 0x25 && bytes[1] === 0x50) return '.pdf'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return '.png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return '.jpg'
  return '.bin'
}

// ── Digital Signatures (Ed25519) ────────────────────────────────────────────

export async function signCid(cid: string, account: any): Promise<{ signature: string, pubkey: string }> {
  // Hash the CID with SHA256
  const cidBytes = new TextEncoder().encode(cid)
  const hashBuffer = await crypto.subtle.digest('SHA-256', cidBytes)
  const hashBytes = new Uint8Array(hashBuffer)

  // Sign using Aptos account's Ed25519 private key
  const signingKey = account.privateKey
  const signatureBytes = signingKey.sign(hashBytes)

  return {
    signature: toB64(signatureBytes.toUint8Array()),
    pubkey: toB64(account.publicKey.toUint8Array()),
  }
}

export async function verifyCidSignature(
  cid: string,
  signatureB64: string,
  pubkeyB64: string,
): Promise<boolean> {
  try {
    const { ed25519 } = await import('@noble/curves/ed25519')
    const cidBytes = new TextEncoder().encode(cid)
    const hashBuffer = await crypto.subtle.digest('SHA-256', cidBytes)
    const hashBytes = new Uint8Array(hashBuffer)
    const sig = fromB64(signatureB64)
    const pub = fromB64(pubkeyB64)
    return ed25519.verify(sig, hashBytes, pub)
  } catch { return false }
}