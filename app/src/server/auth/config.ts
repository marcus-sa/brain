import { betterAuth } from "better-auth";
import type { Surreal } from "surrealdb";
import { surrealdbAdapter } from "./adapter";

export type AuthConfig = {
  betterAuthSecret: string;
  betterAuthUrl: string;
  githubClientId: string;
  githubClientSecret: string;
};

export function createAuth(surreal: Surreal, config: AuthConfig) {
  return betterAuth({
    secret: config.betterAuthSecret,
    baseURL: config.betterAuthUrl,
    basePath: "/api/auth",
    database: surrealdbAdapter(surreal),
    user: {
      modelName: "person",
      fields: {
        email: "contact_email",
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    session: {
      fields: {
        userId: "person_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    account: {
      fields: {
        userId: "person_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        idToken: "id_token",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    verification: {
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    socialProviders: {
      github: {
        clientId: config.githubClientId,
        clientSecret: config.githubClientSecret,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
