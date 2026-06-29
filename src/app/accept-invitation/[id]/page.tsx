"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { authClient } from "@/lib/auth-client";

// Standalone screen the invitee lands on from the invite link. They must be
// signed in with the invited email; Better Auth enforces that on accept.
export default function AcceptInvitationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const invitationId = params.id;

  const { isLoading: authLoading, user } = db.useAuth();

  const [invite, setInvite] = useState<{
    organizationName: string;
    email: string;
  } | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "working" | "error" | "done"
  >("loading");
  const [message, setMessage] = useState<string | null>(null);

  // Load the invitation details once we know who's logged in.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus("error");
      setMessage("Please sign in with the invited email to accept.");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await authClient.organization.getInvitation({
        query: { id: invitationId },
      });
      if (cancelled) return;
      if (error || !data) {
        setStatus("error");
        setMessage(error?.message ?? "Invitation not found or expired.");
        return;
      }
      setInvite({
        organizationName: data.organizationName,
        email: data.email,
      });
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, invitationId]);

  async function accept() {
    setStatus("working");
    const { error } = await authClient.organization.acceptInvitation({
      invitationId,
    });
    if (error) {
      setStatus("error");
      setMessage(error.message ?? "Could not accept invitation.");
      return;
    }
    setStatus("done");
    setTimeout(() => router.push("/"), 800);
  }

  async function reject() {
    setStatus("working");
    const { error } = await authClient.organization.rejectInvitation({
      invitationId,
    });
    if (error) {
      setStatus("error");
      setMessage(error.message ?? "Could not reject invitation.");
      return;
    }
    router.push("/");
  }

  return (
    <div className="font-mono min-h-screen flex justify-center items-center flex-col space-y-6">
      <h2 className="tracking-wide text-5xl text-gray-300">invite</h2>
      <div className="border border-gray-300 max-w-xs w-full p-6 flex flex-col space-y-4">
        {status === "loading" && (
          <p className="text-sm text-gray-400">Loading invitation…</p>
        )}

        {status === "error" && (
          <>
            <p className="text-sm text-red-500">{message}</p>
            <a href="/" className="text-xs text-gray-400 underline hover:text-gray-600">
              Back to app
            </a>
          </>
        )}

        {status === "done" && (
          <p className="text-sm text-gray-600">Joined! Redirecting…</p>
        )}

        {(status === "ready" || status === "working") && invite && (
          <>
            <p className="text-sm text-gray-500">
              You&apos;ve been invited to join{" "}
              <span className="text-gray-800">{invite.organizationName}</span>.
            </p>
            {user?.email !== invite.email && (
              <p className="text-xs text-amber-600">
                This invite is for {invite.email}, but you&apos;re signed in as{" "}
                {user?.email}. Accepting may fail — sign in with the invited
                email.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={accept}
                disabled={status === "working"}
                className="flex-1 border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {status === "working" ? "…" : "Accept"}
              </button>
              <button
                onClick={reject}
                disabled={status === "working"}
                className="border border-gray-300 px-3 py-2 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
