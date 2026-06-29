"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { authClient } from "@/lib/auth-client";
import { type AppSchema } from "@/instant.schema";
import { id, InstaQLEntity, type User } from "@instantdb/react";

type Todo = InstaQLEntity<AppSchema, "todos">;

// Element type of the org list returned by Better Auth's hook.
type Organization = NonNullable<
  ReturnType<typeof authClient.useListOrganizations>["data"]
>[number];

const room = db.room("todos");

// Auth gate: show the login screen when signed out, the app when signed in.
function AuthGate() {
  const { isLoading, user, error } = db.useAuth();
  if (isLoading) {
    return (
      <div className="font-mono min-h-screen flex justify-center items-center text-gray-400">
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="font-mono min-h-screen flex justify-center items-center text-red-500">
        Auth error: {error.message}
      </div>
    );
  }
  if (!user) {
    return <Login />;
  }
  return <App user={user} />;
}

// Better Auth email/password. Sessions are managed by Better Auth and synced
// into InstantDB by <InstantAuth> (see app/providers.tsx), so db.useAuth()
// reflects the logged-in user.
function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const field = (n: string) =>
      form.elements.namedItem(n) as HTMLInputElement;
    const email = field("email").value.trim();
    const password = field("password").value;
    const name = mode === "signup" ? field("name").value.trim() : undefined;
    setError(null);
    setSubmitting(true);
    const { error } =
      mode === "signup"
        ? await authClient.signUp.email({ email, password, name: name! })
        : await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message ?? "Something went wrong. Try again.");
    }
  }

  return (
    <div className="font-mono min-h-screen flex justify-center items-center flex-col space-y-6">
      <h2 className="tracking-wide text-5xl text-gray-300">todos</h2>
      <div className="border border-gray-300 max-w-xs w-full p-6">
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <p className="text-sm text-gray-500">
            {mode === "signup" ? "Create an account" : "Sign in to continue"}
          </p>
          {mode === "signup" && (
            <input
              name="name"
              type="text"
              required
              placeholder="Name"
              className="border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
            />
          )}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required
            minLength={8}
            placeholder="Password"
            className="border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {submitting
              ? "…"
              : mode === "signup"
                ? "Sign up"
                : "Sign in"}
          </button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "Need an account? Sign up"}
        </button>
      </div>
    </div>
  );
}

// Org gate: load the user's organizations, pick an active one, and scope the
// workspace to it. If the user has no org yet, prompt them to create one.
function App({ user }: { user: User }) {
  const { data: orgs, isPending } = authClient.useListOrganizations();
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  // Default the active org to the first one the user belongs to.
  useEffect(() => {
    if (orgs && orgs.length > 0) {
      setActiveOrgId((cur) => cur ?? orgs[0].id);
    }
  }, [orgs]);

  async function switchOrg(orgId: string) {
    setActiveOrgId(orgId);
    await authClient.organization.setActive({ organizationId: orgId });
  }

  if (isPending) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (!orgs || orgs.length === 0) {
    return (
      <CenteredMessage>
        <div className="flex flex-col items-center space-y-6">
          <Header user={user} />
          <CreateOrgForm
            heading="Create your first organization"
            onCreated={(org) => switchOrg(org.id)}
          />
        </div>
      </CenteredMessage>
    );
  }

  if (!activeOrgId) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  return (
    <Workspace
      user={user}
      orgs={orgs}
      activeOrgId={activeOrgId}
      onSwitch={switchOrg}
    />
  );
}

function Workspace({
  user,
  orgs,
  activeOrgId,
  onSwitch,
}: {
  user: User;
  orgs: Organization[];
  activeOrgId: string;
  onSwitch: (orgId: string) => void;
}) {
  // Only todos for the active org — enforced again by permissions server-side.
  const { error, data } = db.useQuery({
    todos: {
      $: {
        where: { organizationId: activeOrgId },
        order: { serverCreatedAt: "desc" },
      },
    },
  });
  const { peers } = db.rooms.usePresence(room);
  const numUsers = 1 + Object.keys(peers).length;
  const [showMembers, setShowMembers] = useState(false);

  return (
    <div className="font-mono min-h-screen flex justify-center items-center flex-col space-y-4 py-12">
      <Header user={user}>
        <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} onSwitch={onSwitch} />
        <button
          className="border border-gray-300 px-2 py-1 hover:bg-gray-50"
          onClick={() => setShowMembers(true)}
          title="Members"
        >
          Members
        </button>
      </Header>
      {showMembers && (
        <MembersPanel
          orgId={activeOrgId}
          currentUserId={user.id}
          onClose={() => setShowMembers(false)}
        />
      )}
      <div className="text-xs text-gray-500">
        Number of users online: {numUsers}
      </div>
      <h2 className="tracking-wide text-5xl text-gray-300">todos</h2>
      <div className="border border-gray-300 max-w-xs w-full">
        <TodoForm orgId={activeOrgId} />
        {error ? (
          <div className="text-red-500 p-4 text-sm">{error.message}</div>
        ) : !data ? (
          <div className="p-4 text-sm text-gray-400">Loading…</div>
        ) : (
          <>
            <TodoList todos={data.todos} />
            <ActionBar todos={data.todos} />
          </>
        )}
      </div>
      <div className="text-xs text-center text-gray-400">
        Todos are scoped to <span className="text-gray-600">this org</span> only.
      </div>
    </div>
  );
}

function Header({
  user,
  children,
}: {
  user: User;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-500">
      {children}
      <span>{user.email}</span>
      <span className="text-gray-300">·</span>
      <button
        className="hover:text-gray-800 underline"
        onClick={() => authClient.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}

function OrgSwitcher({
  orgs,
  activeOrgId,
  onSwitch,
}: {
  orgs: Organization[];
  activeOrgId: string;
  onSwitch: (orgId: string) => void;
}) {
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <div className="absolute left-1/2 top-20 -translate-x-1/2 z-10 bg-white border border-gray-300 p-6 shadow-lg">
        <CreateOrgForm
          heading="New organization"
          onCreated={(org) => {
            setCreating(false);
            onSwitch(org.id);
          }}
          onCancel={() => setCreating(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeOrgId}
        onChange={(e) => onSwitch(e.target.value)}
        className="border border-gray-300 px-2 py-1 text-xs bg-transparent outline-none"
      >
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      <button
        className="border border-gray-300 px-2 py-1 hover:bg-gray-50"
        onClick={() => setCreating(true)}
        title="New organization"
      >
        +
      </button>
    </div>
  );
}

function CreateOrgForm({
  heading,
  onCreated,
  onCancel,
}: {
  heading: string;
  onCreated: (org: Organization) => void;
  onCancel?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = (
      e.currentTarget.elements.namedItem("orgName") as HTMLInputElement
    ).value.trim();
    if (!name) return;
    // Slug must be unique; derive from the name + a short suffix.
    const slug =
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") +
      "-" +
      id().slice(0, 6);
    setError(null);
    setSubmitting(true);
    const { data, error } = await authClient.organization.create({
      name,
      slug,
    });
    setSubmitting(false);
    if (error || !data) {
      setError(error?.message ?? "Could not create organization.");
      return;
    }
    onCreated(data as unknown as Organization);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col space-y-4 w-64 font-mono"
    >
      <p className="text-sm text-gray-500">{heading}</p>
      <input
        name="orgName"
        type="text"
        autoFocus
        required
        placeholder="Acme Inc."
        className="border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {submitting ? "…" : "Create"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="border border-gray-300 px-3 py-2 text-sm text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}

// Member roster + invite flow for the active org. Reads through Better Auth's
// server (getFullOrganization) so it can show co-members' emails without
// loosening the $users read permission. All mutations go server-side too.
type OrgMember = {
  id: string;
  role: string;
  userId: string;
  user: { email: string; name?: string | null };
};
type OrgInvitation = {
  id: string;
  email: string;
  role?: string | null;
  status: string;
};

function MembersPanel({
  orgId,
  currentUserId,
  onClose,
}: {
  orgId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    const { data, error } = await authClient.organization.getFullOrganization({
      query: { organizationId: orgId },
    });
    if (error || !data) {
      setError(error?.message ?? "Could not load members.");
      setLoading(false);
      return;
    }
    setMembers((data.members ?? []) as unknown as OrgMember[]);
    setInvites(
      ((data.invitations ?? []) as unknown as OrgInvitation[]).filter(
        (i) => i.status === "pending",
      ),
    );
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const myRole = members.find((m) => m.userId === currentUserId)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (
      form.elements.namedItem("email") as HTMLInputElement
    ).value.trim();
    const role = (form.elements.namedItem("role") as HTMLSelectElement)
      .value as "member" | "admin" | "owner";
    if (!email) return;
    setError(null);
    setSubmitting(true);
    const { error } = await authClient.organization.inviteMember({
      email,
      role,
      organizationId: orgId,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message ?? "Could not send invite.");
      return;
    }
    form.reset();
    refresh();
  }

  async function cancelInvite(invitationId: string) {
    await authClient.organization.cancelInvitation({ invitationId });
    refresh();
  }

  async function removeMember(memberId: string) {
    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
      organizationId: orgId,
    });
    if (error) {
      setError(error.message ?? "Could not remove member.");
      return;
    }
    refresh();
  }

  return (
    <div className="absolute left-1/2 top-20 -translate-x-1/2 z-10 bg-white border border-gray-300 p-6 shadow-lg w-80 font-mono">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Members</p>
        <button
          onClick={onClose}
          className="text-gray-300 hover:text-gray-600 text-xs"
        >
          close
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <>
          <div className="space-y-1 mb-4">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="truncate">
                  {m.user.email}
                  {m.userId === currentUserId && (
                    <span className="text-gray-400"> (you)</span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-gray-400">{m.role}</span>
                  {canManage &&
                    m.role !== "owner" &&
                    m.userId !== currentUserId && (
                      <button
                        onClick={() => removeMember(m.id)}
                        className="text-gray-300 hover:text-red-500"
                        title="Remove"
                      >
                        ✕
                      </button>
                    )}
                </span>
              </div>
            ))}
          </div>

          {invites.length > 0 && (
            <div className="space-y-1 mb-4 border-t border-gray-200 pt-3">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                Pending
              </p>
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate text-gray-500">{inv.email}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-gray-400">{inv.role ?? "member"}</span>
                    {canManage && (
                      <button
                        onClick={() => cancelInvite(inv.id)}
                        className="text-gray-300 hover:text-red-500"
                        title="Cancel invite"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {canManage ? (
            <form
              onSubmit={invite}
              className="flex flex-col space-y-2 border-t border-gray-200 pt-3"
            >
              <input
                name="email"
                type="email"
                required
                placeholder="invite by email"
                className="border border-gray-300 px-2 py-1 text-xs outline-none focus:border-gray-500"
              />
              <div className="flex gap-2">
                <select
                  name="role"
                  defaultValue="member"
                  className="border border-gray-300 px-2 py-1 text-xs bg-transparent outline-none"
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                  {submitting ? "…" : "Invite"}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-[10px] text-gray-400 border-t border-gray-200 pt-3">
              Only owners and admins can invite members.
            </p>
          )}

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </>
      )}
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono min-h-screen flex justify-center items-center text-gray-400">
      {children}
    </div>
  );
}

// Write Data
// ---------
function addTodo(text: string, orgId: string) {
  db.transact(
    db.tx.todos[id()].update({
      text,
      done: false,
      createdAt: Date.now(),
      organizationId: orgId,
    }),
  );
}

function deleteTodo(todo: Todo) {
  db.transact(db.tx.todos[todo.id].delete());
}

function toggleDone(todo: Todo) {
  db.transact(db.tx.todos[todo.id].update({ done: !todo.done }));
}

function deleteCompleted(todos: Todo[]) {
  const completed = todos.filter((todo) => todo.done);
  const txs = completed.map((todo) => db.tx.todos[todo.id].delete());
  db.transact(txs);
}

function toggleAll(todos: Todo[]) {
  const newVal = !todos.every((todo) => todo.done);
  db.transact(
    todos.map((todo) => db.tx.todos[todo.id].update({ done: newVal })),
  );
}

// Components
// ----------
function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20">
      <path
        d="M5 8 L10 13 L15 8"
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
      />
    </svg>
  );
}

function TodoForm({ orgId }: { orgId: string }) {
  return (
    <div className="flex items-center h-10 border-b border-gray-300">
      <form
        className="flex-1 h-full"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.input as HTMLInputElement;
          if (input.value.trim()) addTodo(input.value.trim(), orgId);
          input.value = "";
        }}
      >
        <input
          className="w-full h-full px-2 outline-none bg-transparent"
          autoFocus
          placeholder="What needs to be done?"
          type="text"
          name="input"
        />
      </form>
    </div>
  );
}

function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <div className="divide-y divide-gray-300">
      {todos.map((todo) => (
        <div key={todo.id} className="flex items-center h-10">
          <div className="h-full px-2 flex items-center justify-center">
            <div className="w-5 h-5 flex items-center justify-center">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={todo.done}
                onChange={() => toggleDone(todo)}
              />
            </div>
          </div>
          <div className="flex-1 px-2 overflow-hidden flex items-center">
            {todo.done ? (
              <span className="line-through">{todo.text}</span>
            ) : (
              <span>{todo.text}</span>
            )}
          </div>
          <button
            className="h-full px-2 flex items-center justify-center text-gray-300 hover:text-gray-500"
            onClick={() => deleteTodo(todo)}
          >
            X
          </button>
        </div>
      ))}
    </div>
  );
}

function ActionBar({ todos }: { todos: Todo[] }) {
  return (
    <div className="flex justify-between items-center h-10 px-2 text-xs border-t border-gray-300">
      <div className="flex items-center gap-2">
        <button
          className="w-4 h-4 text-gray-400 hover:text-gray-700 disabled:opacity-30"
          onClick={() => toggleAll(todos)}
          disabled={todos.length === 0}
          title="Toggle all"
        >
          <ChevronDownIcon />
        </button>
        <span>Remaining: {todos.filter((todo) => !todo.done).length}</span>
      </div>
      <button
        className=" text-gray-300 hover:text-gray-500"
        onClick={() => deleteCompleted(todos)}
      >
        Delete Completed
      </button>
    </div>
  );
}

export default AuthGate;
