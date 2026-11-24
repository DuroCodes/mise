import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { auth, withSignup } from "./auth";
import { db, emailTaken, listUsers } from "./db";
import { invites, user } from "./db/schema";
import { freshToken, linkTokenShape } from "./link-token";

export const inviteTokenShape = linkTokenShape;

const inviteTokenTaken = (token: string) =>
  Boolean(
    db
      .select({ id: invites.id })
      .from(invites)
      .where(eq(invites.token, token))
      .get()
  );

/** older codes (long or with -_/symbols) are swapped the next time the server starts. */
export const shortenInviteTokens = () => {
  const rows = db
    .select({ id: invites.id, token: invites.token })
    .from(invites)
    .all();
  for (const row of rows) {
    if (linkTokenShape.test(row.token)) continue;
    db.update(invites)
      .set({ token: freshToken(inviteTokenTaken) })
      .where(eq(invites.id, row.id))
      .run();
  }
};

export const listInvites = () =>
  db
    .select({
      id: invites.id,
      token: invites.token,
      note: invites.note,
      createdAt: invites.createdAt,
      expiresAt: invites.expiresAt,
      usedAt: invites.usedAt,
      usedByName: user.name,
      usedByEmail: user.email,
    })
    .from(invites)
    .leftJoin(user, eq(user.id, invites.usedBy))
    .orderBy(desc(invites.createdAt))
    .all()
    .map((row) => ({
      id: row.id,
      token: row.token,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      usedAt: row.usedAt ? row.usedAt.toISOString() : null,
      usedBy: row.usedByName
        ? { name: row.usedByName, email: row.usedByEmail ?? "" }
        : null,
    }));

export const createInvite = (createdBy: string, note: string, days: number) => {
  const now = new Date();
  const id = crypto.randomUUID();
  db.insert(invites)
    .values({
      id,
      token: freshToken(inviteTokenTaken),
      note,
      createdBy,
      createdAt: now,
      expiresAt: new Date(now.getTime() + days * 86_400_000),
    })
    .run();
  return id;
};

export const revokeInvite = (id: string) => {
  const row = db
    .select({ id: invites.id })
    .from(invites)
    .where(eq(invites.id, id))
    .get();
  if (!row) return false;
  db.delete(invites).where(eq(invites.id, id)).run();
  return true;
};

const openInvite = (token: string) =>
  and(
    eq(invites.token, token),
    isNull(invites.usedAt),
    gt(invites.expiresAt, new Date())
  );

export const describeInvite = (token: string) => {
  if (!inviteTokenShape.test(token)) return null;
  const row = db
    .select({
      note: invites.note,
      inviterName: user.name,
      expiresAt: invites.expiresAt,
    })
    .from(invites)
    .leftJoin(user, eq(user.id, invites.createdBy))
    .where(openInvite(token))
    .get();
  if (!row) return null;
  return {
    inviterName: row.inviterName ?? null,
    expiresAt: row.expiresAt.toISOString(),
  };
};

export type AcceptResult =
  { ok: true } | { ok: false; status: 400 | 404; error: string };

/**
 * creates a member account from an invite. The invite is claimed first, so
 * two people can't use the same link at once, and released if sign-up fails.
 */
export const acceptInvite = async (
  token: string,
  input: { name: string; email: string; password: string }
) => {
  if (!inviteTokenShape.test(token))
    return {
      ok: false as const,
      status: 404 as const,
      error: "This invite link doesn't work",
    };
  if (emailTaken(input.email))
    return {
      ok: false as const,
      status: 400 as const,
      error: "That email already has an account. Sign in instead.",
    };

  const claimed = db
    .update(invites)
    .set({ usedAt: new Date() })
    .where(openInvite(token))
    .returning({ id: invites.id })
    .all();
  const invite = claimed[0];
  if (!invite)
    return {
      ok: false as const,
      status: 404 as const,
      error: "This invite link has expired or was already used",
    };

  try {
    await withSignup(() => auth.api.signUpEmail({ body: input }));
  } catch (error) {
    db.update(invites)
      .set({ usedAt: null })
      .where(eq(invites.id, invite.id))
      .run();
    const code =
      error &&
      typeof error === "object" &&
      "body" in error &&
      error.body &&
      typeof error.body === "object" &&
      "code" in error.body
        ? String(error.body.code)
        : "";
    if (code.includes("USER_ALREADY_EXISTS"))
      return {
        ok: false as const,
        status: 400 as const,
        error: "That email already has an account. Sign in instead.",
      };
    return {
      ok: false as const,
      status: 400 as const,
      error: "Could not create the account",
    };
  }

  const person = listUsers().find(
    (entry) => entry.email.toLowerCase() === input.email.trim().toLowerCase()
  );
  if (person)
    db.update(invites)
      .set({ usedBy: person.id })
      .where(eq(invites.id, invite.id))
      .run();
  return { ok: true as const };
};
