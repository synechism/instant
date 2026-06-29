// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    // Better Auth maps its "user" model onto Instant's built-in $users.
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      name: i.string().indexed().optional(),
      emailVerified: i.boolean().optional(),
      image: i.string().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
      createdAt: i.date().optional(),
      updatedAt: i.date().optional(),
      age: i.string().optional()
    }),
    // Better Auth entities (plural, per usePlural: true)
    sessions: i.entity({
      expiresAt: i.date(),
      token: i.string().unique(),
      createdAt: i.date(),
      updatedAt: i.date(),
      ipAddress: i.string().optional(),
      userAgent: i.string().optional(),
      userId: i.string(),
      activeOrganizationId: i.string().optional(),
    }),
    accounts: i.entity({
      accountId: i.string(),
      providerId: i.string(),
      userId: i.string(),
      accessToken: i.string().optional(),
      refreshToken: i.string().optional(),
      idToken: i.string().optional(),
      accessTokenExpiresAt: i.date().optional(),
      refreshTokenExpiresAt: i.date().optional(),
      scope: i.string().optional(),
      password: i.string().optional(),
      createdAt: i.date(),
      updatedAt: i.date(),
    }),
    verifications: i.entity({
      identifier: i.string(),
      value: i.string(),
      expiresAt: i.date(),
      createdAt: i.date(),
      updatedAt: i.date(),
    }),
    // Better Auth organization plugin entities
    organizations: i.entity({
      name: i.string().indexed(),
      slug: i.string().unique().indexed(),
      logo: i.string().optional(),
      createdAt: i.date(),
      metadata: i.string().optional(),
    }),
    members: i.entity({
      organizationId: i.string().indexed(),
      userId: i.string().indexed(),
      role: i.string().indexed(),
      createdAt: i.date(),
    }),
    invitations: i.entity({
      organizationId: i.string().indexed(),
      email: i.string().indexed(),
      role: i.string().optional().indexed(),
      status: i.string().indexed(),
      expiresAt: i.date(),
      createdAt: i.date(),
      inviterId: i.string(),
    }),
    todos: i.entity({
      text: i.string(),
      done: i.boolean(),
      createdAt: i.number(),
      // Scopes a todo to an organization (Better Auth org id).
      organizationId: i.string().indexed().optional(),
    }),
  },
  links: {
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    sessionsUser: {
      forward: {
        on: "sessions",
        has: "one",
        label: "user",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "sessions",
      },
    },
    accountsUser: {
      forward: {
        on: "accounts",
        has: "one",
        label: "user",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "accounts",
      },
    },
    membersOrganization: {
      forward: {
        on: "members",
        has: "one",
        label: "organization",
        onDelete: "cascade",
      },
      reverse: {
        on: "organizations",
        has: "many",
        label: "members",
      },
    },
    membersUser: {
      forward: {
        on: "members",
        has: "one",
        label: "user",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "members",
      },
    },
    invitationsOrganization: {
      forward: {
        on: "invitations",
        has: "one",
        label: "organization",
        onDelete: "cascade",
      },
      reverse: {
        on: "organizations",
        has: "many",
        label: "invitations",
      },
    },
    invitationsInviter: {
      forward: {
        on: "invitations",
        has: "one",
        label: "inviter",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "invitations",
      },
    },
  },
  rooms: {
    todos: {
      presence: i.entity({}),
    },
  },
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
