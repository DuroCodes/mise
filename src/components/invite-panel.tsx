import {
  CopyIcon,
  LinkIcon,
  QrCodeIcon,
  Share2Icon,
  TrashIcon,
} from "lucide-react";
import { useEffect, useState, type SubmitEvent } from "react";
import { toast } from "sonner";
import { QrCode } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  createInvite,
  listInvites,
  revokeInvite,
  type Invite,
} from "@/lib/api";

const linkFor = (token: string) => `${window.location.origin}/invite/${token}`;

const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Invite link copied");
  } catch {
    toast.error("Could not copy. Select the link and copy it.");
  }
};

function InvitePanel() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [note, setNote] = useState("");
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [pending, setPending] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [showing, setShowing] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    listInvites().then((result) => {
      if (active && result.ok) setInvites(result.value);
    });
    return () => {
      active = false;
    };
  }, []);

  const create = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    const result = await createInvite({ note, days });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setInvites(result.value);
    setNote("");
    const newest = result.value[0];
    if (newest) {
      setFresh(newest.id);
      void copy(linkFor(newest.token));
    }
  };

  const revoke = async (id: string) => {
    const result = await revokeInvite(id);
    if (!result.ok) toast.error(result.error);
    else setInvites(result.value);
  };

  const open = (invites ?? []).filter(
    (invite) => !invite.usedAt && Date.parse(invite.expiresAt) > now
  );
  const used = (invites ?? []).filter((invite) => invite.usedAt).slice(0, 10);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium tracking-tight">Invite links</h2>
      <div className="space-y-4 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
        <p className="leading-6 text-muted-foreground">
          One-time links for new accounts.
        </p>
        <form
          onSubmit={create}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="invite-note">Who is it for? (optional)</Label>
            <Input
              id="invite-note"
              value={note}
              maxLength={80}
              placeholder="Mom"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-days">Expires in</Label>
            <Select
              value={String(days)}
              onValueChange={(value) => setDays(Number(value) as 1 | 7 | 30)}
            >
              <SelectTrigger
                id="invite-days"
                aria-label="Expires in"
                className="w-full sm:w-32"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            <LinkIcon data-icon="inline-start" />
            {pending ? "Creating" : "Create invite link"}
          </Button>
        </form>

        {open.length > 0 && (
          <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
            {open.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {invite.note || "Invite"}
                    {fresh === invite.id && (
                      <span className="ml-2 text-xs font-normal text-brand">
                        copied
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {linkFor(invite.token)} · expires {when(invite.expiresAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copy(linkFor(invite.token))}
                  >
                    <CopyIcon data-icon="inline-start" />
                    Copy
                  </Button>
                  {"share" in navigator && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Share the invite${invite.note ? ` for ${invite.note}` : ""}`}
                      onClick={() =>
                        void navigator
                          .share({
                            title: "Join me on Mise",
                            url: linkFor(invite.token),
                          })
                          .catch(() => undefined)
                      }
                    >
                      <Share2Icon />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={showing === invite.id ? "secondary" : "outline"}
                    size="icon-sm"
                    aria-pressed={showing === invite.id}
                    aria-label={`QR code for the invite${invite.note ? ` for ${invite.note}` : ""}`}
                    onClick={() =>
                      setShowing(showing === invite.id ? null : invite.id)
                    }
                  >
                    <QrCodeIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Revoke the invite${invite.note ? ` for ${invite.note}` : ""}`}
                    onClick={() => void revoke(invite.id)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
                {showing === invite.id && (
                  <div className="w-full pt-2">
                    <QrCode
                      value={linkFor(invite.token)}
                      label="Invite QR code"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {used.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Recently used
            </p>
            <ul className="space-y-1 text-muted-foreground">
              {used.map((invite) => (
                <li key={invite.id}>
                  {invite.usedBy
                    ? `${invite.usedBy.name} (${invite.usedBy.email})`
                    : "An account that was removed"}{" "}
                  joined {invite.usedAt ? when(invite.usedAt) : ""}
                  {invite.note && ` · ${invite.note}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export { InvitePanel };
