import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { instantAdapter } from "better-auth-instantdb";
import { init } from "@instantdb/admin";
import schema from "../instant.schema";
import { sendOrganizationInvitation } from "./email";

// InstantDB admin client — used by Better Auth to read/write auth entities.
export const adminDb = init({
  schema,
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN!,
  useDateObjects: true,
});

export const auth = betterAuth({
  database: instantAdapter({
    db: adminDb,
    usePlural: true, // our schema uses plural table names (users, sessions, ...)
    debugLogs: false,
  }),
  emailAndPassword: {
    enabled: true,
  },
  // InstantDB only accepts UUIDs as entity ids. Some plugin code paths (e.g.
  // the org plugin's createInvitation) pre-generate ids via context.generateId,
  // which otherwise emits non-UUID nanoids that InstantDB rejects. Forcing UUIDs
  // here makes every generated id InstantDB-compatible.
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  plugins: [
    organization({
      // Delivery hook for member invitations. Better Auth assembles the data
      // and decides when to send; we hand it to Postmark (see lib/email.ts).
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.BETTER_AUTH_URL}/accept-invitation/${data.id}?email=${encodeURIComponent(data.email)}`;
        await sendOrganizationInvitation({
          email: data.email,
          invitedByUsername: data.inviter.user.name,
          invitedByEmail: data.inviter.user.email,
          teamName: data.organization.name,
          inviteLink,
        });
      },
    }),
  ],
});
