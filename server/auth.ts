import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { countUsers, dataDir, db } from "./db";
import * as schema from "./db/schema";

const secretFile = `${dataDir}/auth-secret`;

const secret = () => {
  const fromEnv = process.env.BETTER_AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (existsSync(secretFile)) return readFileSync(secretFile, "utf8").trim();
  const generated = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  writeFileSync(secretFile, generated, { mode: 0o600 });
  return generated;
};

const trustedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  // phone on the same wifi / tailscale (bun dev exposes vite with --host).
  "http://192.168.*.*:5173",
  "http://10.*.*.*:5173",
  "http://100.*.*.*:5173",
];
if (process.env.BETTER_AUTH_URL)
  trustedOrigins.push(process.env.BETTER_AUTH_URL);

let signupPermits = 0;

export const withSignup = async <T>(run: () => Promise<T>) => {
  signupPermits += 1;
  try {
    return await run();
  } finally {
    signupPermits -= 1;
  }
};

export const auth = betterAuth({
  secret: secret(),
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
    camelCase: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "member",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (record) => {
          const existing = countUsers();
          if (existing > 0 && signupPermits === 0) {
            throw APIError.from("FORBIDDEN", {
              code: "SIGN_UP_CLOSED",
              message: "Ask an admin for an account",
            });
          }
          return {
            data: {
              ...record,
              role: existing === 0 ? "admin" : "member",
            },
          };
        },
      },
    },
  },
});

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export const sessionUser = async (headers: Headers) => {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const role =
    "role" in session.user && typeof session.user.role === "string"
      ? session.user.role
      : "member";
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role,
  } satisfies SessionUser;
};
