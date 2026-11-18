import {
  CheckIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const copyLink = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    toast.error("Could not copy. Select the link and copy it.");
    return false;
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

  useEffect(() => {
    if (!fresh) return;
    const id = window.setTimeout(() => setFresh(null), 2000);
    return () => window.clearTimeout(id);
  }, [fresh]);

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
    if (newest && (await copyLink(linkFor(newest.token)))) setFresh(newest.id);
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Note</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {open.map((invite) => {
                const href = linkFor(invite.token);
                const justCopied = fresh === invite.id;
                return (
                  <TableRow key={invite.id}>
                    <TableCell className="max-w-[10rem] truncate font-medium">
                      {invite.note || "Invite"}
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate font-mono text-xs text-muted-foreground">
                      {href}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {when(invite.expiresAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-w-[5.5rem]"
                          onClick={async () => {
                            if (await copyLink(href)) setFresh(invite.id);
                          }}
                        >
                          {justCopied ? (
                            <CheckIcon data-icon="inline-start" />
                          ) : (
                            <CopyIcon data-icon="inline-start" />
                          )}
                          {justCopied ? "Copied" : "Copy"}
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
                                  url: href,
                                })
                                .catch(() => undefined)
                            }
                          >
                            <Share2Icon />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant={
                            showing === invite.id ? "secondary" : "outline"
                          }
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
                        <div className="mt-2 flex justify-end">
                          <QrCode value={href} label="Invite QR code" />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {used.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Recently used
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {used.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">
                      {invite.usedBy?.name ?? "Removed account"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invite.usedBy?.email ?? ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invite.usedAt ? when(invite.usedAt) : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invite.note}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  );
}

export { InvitePanel };
