import { describe, it, expect } from "bun:test";
import { generateDPoPKeyMaterial, createDPoPProof } from "../../../cli/dpop";
import { computeJwkThumbprint } from "../../../app/shared/dpop";
import * as jose from "jose";

describe("CLI DPoP", () => {
  describe("generateDPoPKeyMaterial", () => {
    it("generates ES256 key pair with thumbprint", async () => {
      const material = await generateDPoPKeyMaterial();

      expect(material.privateJwk.kty).toBe("EC");
      expect(material.privateJwk.crv).toBe("P-256");
      expect(material.privateJwk.d).toBeDefined(); // private key component
      expect(material.publicJwk.kty).toBe("EC");
      expect(material.publicJwk.crv).toBe("P-256");
      expect(material.publicJwk.d).toBeUndefined(); // no private component
      expect(material.thumbprint).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    });

    it("generates different key pairs each time", async () => {
      const a = await generateDPoPKeyMaterial();
      const b = await generateDPoPKeyMaterial();

      expect(a.thumbprint).not.toBe(b.thumbprint);
    });
  });

  describe("createDPoPProof", () => {
    it("creates a valid DPoP proof JWT", async () => {
      const material = await generateDPoPKeyMaterial();
      const proof = await createDPoPProof(
        material.privateJwk,
        material.publicJwk,
        "POST",
        "https://example.com/api/auth/token",
      );

      // Decode header
      const header = jose.decodeProtectedHeader(proof);
      expect(header.alg).toBe("ES256");
      expect(header.typ).toBe("dpop+jwt");
      expect(header.jwk).toBeDefined();
      expect((header.jwk as jose.JWK).kty).toBe("EC");

      // Verify signature
      const publicKey = await jose.importJWK(header.jwk as jose.JWK, "ES256");
      const { payload } = await jose.jwtVerify(proof, publicKey);

      expect(payload.htm).toBe("POST");
      expect(payload.htu).toBe("https://example.com/api/auth/token");
      expect(payload.jti).toBeDefined();
      expect(typeof payload.iat).toBe("number");
    });

    it("generates unique jti per proof", async () => {
      const material = await generateDPoPKeyMaterial();
      const proof1 = await createDPoPProof(material.privateJwk, material.publicJwk, "GET", "https://example.com/a");
      const proof2 = await createDPoPProof(material.privateJwk, material.publicJwk, "GET", "https://example.com/a");

      const publicKey = await jose.importJWK(
        jose.decodeProtectedHeader(proof1).jwk as jose.JWK,
        "ES256",
      );
      const p1 = (await jose.jwtVerify(proof1, publicKey)).payload;
      const p2 = (await jose.jwtVerify(proof2, publicKey)).payload;

      expect(p1.jti).not.toBe(p2.jti);
    });

    it("binds proof to specific HTTP method and URL", async () => {
      const material = await generateDPoPKeyMaterial();
      const proof = await createDPoPProof(
        material.privateJwk,
        material.publicJwk,
        "DELETE",
        "https://example.com/resource/123",
      );

      const publicKey = await jose.importJWK(
        jose.decodeProtectedHeader(proof).jwk as jose.JWK,
        "ES256",
      );
      const { payload } = await jose.jwtVerify(proof, publicKey);

      expect(payload.htm).toBe("DELETE");
      expect(payload.htu).toBe("https://example.com/resource/123");
    });

    it("proof thumbprint matches key material thumbprint", async () => {
      const material = await generateDPoPKeyMaterial();
      const proof = await createDPoPProof(
        material.privateJwk,
        material.publicJwk,
        "POST",
        "https://example.com/token",
      );

      // The proof's embedded JWK should produce the same thumbprint
      const header = jose.decodeProtectedHeader(proof);
      const proofThumbprint = await computeJwkThumbprint(header.jwk as JsonWebKey);

      expect(proofThumbprint).toBe(material.thumbprint);
    });
  });
});
