import { CopyIcon, Share2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QrCode } from "@/components/qr-code";
import { Input } from "@/components/ui/input";
import { createShareLink, removeShareLink } from "@/lib/api";

const linkFor = (token: string) => `${window.location.origin}/s/${token}`;

function ShareRecipe({
  recipeId,
  title,
  token,
  onToken,
}: {
  recipeId: string;
  title: string;
  token: string | null;
  onToken: (token: string | null) => void;
}) {
  const [pending, setPending] = useState(false);
  const link = token ? linkFor(token) : "";

  const create = async () => {
    setPending(true);
    const result = await createShareLink(recipeId);
    setPending(false);
    if (!result.ok) toast.error(result.error);
    else onToken(result.value.token);
  };

  const revoke = async () => {
    setPending(true);
    const result = await removeShareLink(recipeId);
    setPending(false);
    if (!result.ok) toast.error(result.error);
    else {
      onToken(null);
      toast.success("The link no longer works");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy. Select the link and copy it.");
    }
  };

  const shareNative = async () => {
    try {
      await navigator.share({ title, url: link });
    } catch {
      // The person closed the share sheet.
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Share ${title}`}
        >
          <Share2Icon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {title}</DialogTitle>
          <DialogDescription>
            Anyone with the link can view this recipe. No account needed.
          </DialogDescription>
        </DialogHeader>
        {token ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                readOnly
                value={link}
                aria-label="Share link"
                onFocus={(event) => event.target.select()}
              />
              <Button type="button" variant="outline" onClick={copy}>
                <CopyIcon data-icon="inline-start" />
                Copy
              </Button>
            </div>
            <QrCode value={link} label={`QR code for ${title}`} />
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={revoke}
              >
                Turn off link
              </Button>
              {"share" in navigator && (
                <Button type="button" onClick={shareNative}>
                  <Share2Icon data-icon="inline-start" />
                  Share…
                </Button>
              )}
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button type="button" disabled={pending} onClick={create}>
              {pending ? "Creating" : "Create a link"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { ShareRecipe };
