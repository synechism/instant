"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db";
import { authClient } from "@/lib/auth-client";

// Invite landing page. If the visitor isn't signed in, we show an inline
// sign-up form (pre-filled and locked to the invited email) so there's no
// detour. The moment they're authenticated we auto-accept the invitation and
// drop them into the organization.
export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<Shell>Loading…</Shell>}>
      <AcceptInvitation />
    </Suspense>
  );
}

function AcceptInvitation() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const invitationId = params.id;
  const invitedEmail = searchParams.get("email") ?? "";

  const { isLoading: authLoading, user } = db.useAuth();

  const [status, setStatus] = useState<
    "idle" | "accepting" | "error" | "done"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const acceptedRef = useRef(false);

  // Once signed in, accept the invitation automatically and head to the app.
  useEffect(() => {
    if (authLoading || !user) return;
    if (acceptedRef.current) return;
    acceptedRef.current = true;

    (async () => {
      setStatus("accepting");

      // Look up the invitation so we can validate the email and set the
      // active org after joining.
      const { data: invite, error: getErr } =
        await authClient.organization.getInvitation({
          query: { id: invitationId },
        });
      if (getErr || !invite) {
        setStatus("error");
        setMessage(getErr?.message ?? "Invitation not found or expired.");
        return;
      }
      if (user.email !== invite.email) {
        setStatus("error");
        setMessage(
          `This invitation was sent to ${invite.email}, but you're signed in as ${user.email}. Sign out and sign in with the invited email.`,
        );
        return;
      }

      const { error: acceptErr } =
        await authClient.organization.acceptInvitation({ invitationId });
      if (acceptErr) {
        setStatus("error");
        setMessage(acceptErr.message ?? "Could not accept the invitation.");
        return;
      }

      await authClient.organization.setActive({
        organizationId: invite.organizationId,
      });
      setStatus("done");
      router.push("/");
    })();
  }, [authLoading, user, invitationId, router]);

  if (authLoading) return <Shell>Loading…</Shell>;

  // Signed out → inline auth (defaults to sign-up for new invitees).
  if (!user) {
    return (
      <Shell>
        <InviteAuthForm invitedEmail={invitedEmail} />
      </Shell>
    );
  }

  // Signed in → accepting / done / error states.
  return (
    <Shell>
      {status === "error" ? (
        <div className="flex flex-col space-y-4">
          <p className="text-sm text-red-500">{message}</p>
          <button
            onClick={() => authClient.signOut()}
            className="border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
          >
            Sign out
          </button>
          <a
            href="/"
            className="text-xs text-gray-400 underline hover:text-gray-600"
          >
            Back to app
          </a>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Joining organization…</p>
      )}
    </Shell>
  );
}

// Sign up (or sign in) right on the invite page. Email is locked to the
// invited address so the accepted session always matches the invitation.
function InviteAuthForm({ invitedEmail }: { invitedEmail: string }) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
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
    // On success, db.useAuth() flips to signed-in and the parent auto-accepts.
    if (error) {
      setError(error.message ?? "Something went wrong. Try again.");
    }
  }

  return (
    <div className="flex flex-col space-y-4">
      <p className="text-sm text-gray-500">
        {mode === "signup"
          ? "Create your account to join the organization."
          : "Sign in to join the organization."}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
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
          defaultValue={invitedEmail}
          readOnly={!!invitedEmail}
          placeholder="you@example.com"
          className="border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 read-only:bg-gray-50 read-only:text-gray-500"
        />
        <input
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
          {submitting ? "…" : mode === "signup" ? "Sign up & join" : "Sign in & join"}
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </form>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError(null);
        }}
        className="text-xs text-gray-400 hover:text-gray-600 underline"
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : "Need an account? Sign up"}
      </button>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono min-h-screen flex justify-center items-center flex-col space-y-6">
      <h2 className="tracking-wide text-5xl text-gray-300">invite</h2>
      <div className="border border-gray-300 max-w-xs w-full p-6">{children}</div>
    </div>
  );
}
