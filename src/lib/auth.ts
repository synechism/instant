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
  plugins: [
    organization({
      // Delivery hook for member invitations. Better Auth assembles the data
      // and decides when to send; we hand it to Postmark (see lib/email.ts).
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.BETTER_AUTH_URL}/accept-invitation/${data.id}`;
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
