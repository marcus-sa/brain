/**
 * CLI DPoP — thin wrapper around shared DPoP primitives.
 *
 * Re-exports generateKeyPair and createDPoPProof from app/shared/dpop.
 * Adds generateDPoPKeyMaterial() convenience for CLI config storage
 * (returns only JWK + thumbprint, no CryptoKey handles).
 */
import {
  generateKeyPair,
  createDPoPProof as sharedCreateDPoPProof,
  type DPoPKeyPair,
} from "../app/shared/dpop";

export type { DPoPKeyPair } from "../app/shared/dpop";

export type DPoPKeyMaterial = {
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
  thumbprint: string;
};

/**
 * Generate DPoP key material suitable for CLI config persistence.
 * Returns only serializable JWKs (no CryptoKey handles).
 */
export async function generateDPoPKeyMaterial(): Promise<DPoPKeyMaterial> {
  const kp = await generateKeyPair();
  return {
    privateJwk: kp.privateJwk,
    publicJwk: kp.publicJwk,
    thumbprint: kp.thumbprint,
  };
}

/**
 * Create a fresh DPoP proof JWT for a single HTTP request.
 * Delegates to the shared implementation, accepting JWK private key.
 */
export async function createDPoPProof(
  privateJwk: JsonWebKey,
  publicJwk: JsonWebKey,
  method: string,
  url: string,
): Promise<string> {
  return sharedCreateDPoPProof(privateJwk, publicJwk, method, url);
}
