
## 1. The `invitations` table

Defined in [`src/instant.schema.ts`](../src/instant.schema.ts). Better Auth's
`invitation` model is mapped onto this InstantDB entity (pluralized because the
adapter runs with `usePlural: true`).

| Field            | Type                          | Notes                                                                 |
| ---------------- | ----------------------------- | --------------------------------------------------------------------- |
| `id`             | UUID (entity id)              | Primary key. **This is the value embedded in the invite link.**       |
| `organizationId` | `i.string().indexed()`        | The org the invitee is being added to.                                |
| `email`          | `i.string().indexed()`        | Lowercased recipient address. Accept requires the session to match.   |
| `role`           | `i.string().optional().indexed()` | Role to grant on accept (`member` / `admin` / `owner`).           |
| `status`         | `i.string().indexed()`        | `pending` → `accepted` / `rejected` / `canceled`.                     |
| `expiresAt`      | `i.date()`                    | Default **48 hours** after creation.                                  |
| `createdAt`      | `i.date()`                    | Set at creation.                                                       |
| `inviterId`      | `i.string()`                  | `$users.id` of whoever sent the invite.                               |

### Links (relations)

- `invitationsOrganization` — `invitations.organization` → `organizations`
  (reverse: `organizations.invitations`), `onDelete: cascade`.
- `invitationsInviter` — `invitations.inviter` → `$users`
  (reverse: `$users.invitations`), `onDelete: cascade`.

> Note: the row stores both a scalar foreign key (`organizationId`, `inviterId`)
> **and** a link (`organization`, `inviter`). Better Auth reads/writes the scalar
> fields; the links exist so InstantDB queries can traverse relations.

---

## 2. How the invitation `id` is generated
**InstantDB only accepts UUIDs as entity ids.** Any non-UUID id passed in a
transaction throws:

```
Invalid id for entity 'invitations'. Expected a UUID, but received: 3cS8udEzH6ZdntkjLgrWWdUrP6j4ojJ3
```

### How Better Auth generates the id

When you call `authClient.organization.inviteMember(...)`, the org plugin's
`createInvitation` runs on the server and explicitly pre-generates the id:

```js
// node_modules/better-auth/dist/plugins/organization/adapter.mjs
const invitationId = context.generateId({ model: "invitation" });
return await adapter.create({
  model: "invitation",
  data: { id: invitationId, status: "pending", expiresAt, createdAt, inviterId, ...invitation },
  forceAllowId: true,
});
```

`context.generateId` resolves in this precedence
(`@better-auth/core` → `create-context.mjs`):

1. `advanced.generateId` (function) — if set
2. `advanced.database.generateId` — `"uuid"` → `crypto.randomUUID()`, `"serial"`/`false` → disabled, or a custom function
3. fallback → Better Auth's **nanoid** generator (e.g. `3cS8udEzH6ZdntkjLgrWWdUrP6j4ojJ3`)

The default (step 3) is a nanoid, which InstantDB rejects. Note this path
pre-generates the id and passes it with `forceAllowId: true`, so it bypasses the
adapter's own UUID generator — meaning the InstantDB adapter's `customIdGenerator`
does **not** save us here.

### Our fix

We force UUIDs globally in [`src/lib/auth.ts`](../src/lib/auth.ts):

```ts
export const auth = betterAuth({
  // ...
  advanced: {
    database: {
      generateId: "uuid", // every generated id is crypto.randomUUID() → InstantDB-compatible
    },
  },
  // ...
});
```

With this, `context.generateId({ model: "invitation" })` returns a v4 UUID such
as `3d6ca23c-7d2e-4761-ba80-154b7b1036cb`, which InstantDB stores as the row's
`id`. This setting applies to **all** models, so organizations, members, etc. all
get UUIDs too (consistent and compatible).

---

## 3. From `id` to invitation link

The id is the only dynamic part of the link. The link is assembled in the
`sendInvitationEmail` callback in [`src/lib/auth.ts`](../src/lib/auth.ts):

```ts
organization({
  async sendInvitationEmail(data) {
    const inviteLink =
      `${process.env.BETTER_AUTH_URL}/accept-invitation/${data.id}` +
      `?email=${encodeURIComponent(data.email)}`;
    await sendOrganizationInvitation({
      email: data.email,
      invitedByUsername: data.inviter.user.name,
      invitedByEmail: data.inviter.user.email,
      teamName: data.organization.name,
      inviteLink,
    });
  },
})
```

So the link shape is:

```
{BETTER_AUTH_URL}/accept-invitation/{invitation.id}?email={urlEncoded(invitation.email)}
```

Example:

```
http://localhost:3000/accept-invitation/3d6ca23c-7d2e-4761-ba80-154b7b1036cb?email=invitee%40cronsrc.com
```

## 4. What the link does (accept flow)

Route: [`src/app/accept-invitation/[id]/page.tsx`](../src/app/accept-invitation/[id]/page.tsx)

1. Read `id` from the path and `email` from the query string.
2. If signed out → show an inline sign-up/sign-in form, email pre-filled & locked.
3. Once authenticated, automatically:
   - `authClient.organization.getInvitation({ query: { id } })` — fetch + validate.
   - Verify `session.user.email === invitation.email`.
   - `authClient.organization.acceptInvitation({ invitationId: id })` — creates a
     `members` row, flips invitation `status` to `accepted`.
   - `authClient.organization.setActive({ organizationId })` and redirect to `/`.

