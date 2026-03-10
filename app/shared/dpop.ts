/**
 * Shared DPoP Primitives (RFC 9449)
 *
 * Pure functions for DPoP key pair generation, JWK thumbprint computation
 * (RFC 7638), and DPoP proof JWT creation. Used by server, CLI, and tests.
 *
 * Server-side validation (validateDPoPProof) remains in
 * app/src/server/oauth/dpop.ts — it is not needed by clients.
 */
import * as jose from "jose";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Key pair with both CryptoKey handles and exportable JWK representations. */
export type DPoPKeyPair = {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
  thumbprint: string;
};

// ---------------------------------------------------------------------------
// Key Pair Generation (ES256 / ECDSA P-256)
// ---------------------------------------------------------------------------

/**
 * Generate an ES256 key pair with pre-computed JWK thumbprint.
 * Keys are exportable so they can be persisted (CLI config) or
 * serialized (test fixtures).
 */
export async function generateKeyPair(): Promise<DPoPKeyPair> {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  const publicJwk = await crypto.subtle.exportKey("jwk", publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", privateKey);
  const thumbprint = await computeJwkThumbprint(publicJwk);

  return { privateKey, publicKey, privateJwk, publicJwk, thumbprint };
}

// ---------------------------------------------------------------------------
// JWK Thumbprint (RFC 7638)
// ---------------------------------------------------------------------------

/**
 * Compute a JWK thumbprint per RFC 7638.
 *
 * For EC keys: canonical JSON of { crv, kty, x, y } in lexicographic order,
 * SHA-256 hashed, base64url-encoded.
 */
export async function computeJwkThumbprint(
  publicJwk: JsonWebKey,
): Promise<string> {
  const thumbprintInput = JSON.stringify({
    crv: publicJwk.crv,
    kty: publicJwk.kty,
    x: publicJwk.x,
    y: publicJwk.y,
  });

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(thumbprintInput),
  );

  return base64url(new Uint8Array(hashBuffer));
}

// ---------------------------------------------------------------------------
// DPoP Proof Creation
// ---------------------------------------------------------------------------

/**
 * Create a fresh DPoP proof JWT for a single HTTP request.
 *
 * Each proof has a unique jti and is bound to the specific HTTP method
 * and target URL. Accepts either CryptoKey or JWK for the private key
 * to support both in-memory (server/tests) and persisted (CLI) usage.
 */
export async function createDPoPProof(
  privateKey: CryptoKey | JsonWebKey,
  publicJwk: JsonWebKey,
  method: string,
  url: string,
): Promise<string> {
  const signingKey =
    privateKey instanceof CryptoKey
      ? privateKey
      : await crypto.subtle.importKey(
          "jwk",
          privateKey,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign"],
        );

  return new jose.SignJWT({
    jti: crypto.randomUUID(),
    htm: method,
    htu: url,
    iat: Math.floor(Date.now() / 1000),
  })
    .setProtectedHeader({
      alg: "ES256",
      typ: "dpop+jwt",
      jwk: {
        kty: publicJwk.kty!,
        crv: publicJwk.crv!,
        x: publicJwk.x!,
        y: publicJwk.y!,
      },
    })
    .sign(signingKey);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function base64url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
