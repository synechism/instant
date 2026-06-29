// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";

// auth.ref('$user.members.organizationId') => list of org ids the current
// user is a member of. This is the basis for all org-scoped access.
const rules = {
  // Prevent the client from creating new attributes without an explicit schema change.
  attrs: {
    allow: {
      $default: "false",
    },
  },
  // Better Auth maps users onto $users. Writes happen via the admin SDK
  // (which bypasses permissions), so the client only needs read access to itself.
  $users: {
    bind: ["isOwner", "auth.id != null && auth.id == data.id"],
    allow: {
      view: "isOwner",
      create: "false",
      delete: "false",
      update: "false",
    },
  },
  sessions: {
    bind: ["isOwner", "auth.id != null && auth.id == data.userId"],
    allow: {
      view: "isOwner",
      create: "false",
      delete: "false",
      update: "false",
    },
  },
  accounts: {
    bind: ["isOwner", "auth.id != null && auth.id == data.userId"],
    allow: {
      view: "isOwner",
      create: "false",
      delete: "false",
      update: "false",
    },
  },
  verifications: {
    allow: {
      $default: "false",
    },
  },
  // --- Organization plugin entities ---
  // All writes go through the Better Auth server (admin SDK), so the client
  // only gets read access scoped to the orgs the user belongs to.
  organizations: {
    bind: [
      "isMember",
      "auth.id != null && data.id in auth.ref('$user.members.organizationId')",
    ],
    allow: {
      view: "isMember",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  members: {
    bind: [
      "sharesOrg",
      "auth.id != null && data.organizationId in auth.ref('$user.members.organizationId')",
    ],
    allow: {
      view: "sharesOrg",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  invitations: {
    bind: [
      "sharesOrg",
      "auth.id != null && data.organizationId in auth.ref('$user.members.organizationId')",
    ],
    allow: {
      view: "sharesOrg",
      create: "false",
      update: "false",
      delete: "false",
    },
  },
  // --- App data: todos are scoped to an organization ---
  // A user can only touch todos in an org they're a member of, and a todo
  // can't be moved to a different org. This guarantees org-to-org isolation.
  todos: {
    bind: [
      "isOrgMember",
      "auth.id != null && data.organizationId in auth.ref('$user.members.organizationId')",
    ],
    allow: {
      view: "isOrgMember",
      create: "isOrgMember",
      update: "isOrgMember && newData.organizationId == data.organizationId",
      delete: "isOrgMember",
    },
  },
} satisfies InstantRules;

export default rules;
