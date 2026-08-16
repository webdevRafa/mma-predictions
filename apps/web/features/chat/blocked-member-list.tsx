"use client";

import { LoaderCircle, UserRoundCheck, UserRoundX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getFirebaseAppCheckToken } from "@/lib/firebase/client";

export interface BlockedMemberItem {
  uid: string;
  handle?: string | undefined;
}

export function BlockedMemberList({
  initialMembers,
}: {
  initialMembers: BlockedMemberItem[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unblock(member: BlockedMemberItem) {
    setBusyUid(member.uid);
    setError(null);
    try {
      const appCheckToken = await getFirebaseAppCheckToken();
      const response = await fetch("/api/chat/blocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(appCheckToken ? { "X-Firebase-AppCheck": appCheckToken } : {}),
        },
        body: JSON.stringify({ targetUid: member.uid, blocked: false }),
      });
      if (!response.ok) throw new Error("Member could not be unblocked");
      setMembers((current) =>
        current.filter((item) => item.uid !== member.uid),
      );
    } catch (unblockError) {
      setError(
        unblockError instanceof Error
          ? unblockError.message
          : "Member could not be unblocked",
      );
    } finally {
      setBusyUid(null);
    }
  }

  if (members.length === 0)
    return (
      <div className="p-6 text-center">
        <UserRoundX
          aria-hidden="true"
          className="mx-auto text-fl-text-dim"
          size={28}
        />
        <p className="mt-4 font-semibold">No blocked users</p>
        <p className="mt-2 text-sm text-fl-text-muted">
          Members you block in a fight lobby will appear here.
        </p>
      </div>
    );

  return (
    <div className="divide-y divide-fl-border">
      {error ? (
        <p
          className="m-5 rounded-lg bg-fl-danger/10 p-3 text-sm text-fl-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {members.map((member) => (
        <div
          className="flex items-center justify-between gap-4 p-5"
          key={member.uid}
        >
          <div className="flex min-w-0 items-center gap-3">
            <UserRoundCheck className="shrink-0 text-fl-text-dim" size={20} />
            {member.handle ? (
              <Link
                className="focus-ring truncate rounded text-sm font-bold hover:text-fl-accent"
                href={`/u/${member.handle}`}
              >
                @{member.handle}
              </Link>
            ) : (
              <span className="text-sm font-semibold">Blocked member</span>
            )}
          </div>
          <Button
            disabled={busyUid === member.uid}
            onClick={() => unblock(member)}
            size="sm"
            variant="secondary"
          >
            {busyUid === member.uid ? (
              <LoaderCircle className="animate-spin" size={14} />
            ) : null}
            Unblock
          </Button>
        </div>
      ))}
    </div>
  );
}
