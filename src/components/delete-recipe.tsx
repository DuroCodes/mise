import { TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { removeRecipe } from "@/lib/api";
import { match } from "@/lib/result";
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

function DeleteRecipe({
  id,
  title,
  onDeleted,
}: {
  id: string;
  title: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const remove = async () => {
    setPending(true);
    const result = await removeRecipe(id);
    match(
      result,
      () => {
        setOpen(false);
        onDeleted();
      },
      (error) => {
        toast.error(error);
        setPending(false);
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Delete ${title}`}
        >
          <TrashIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {title}?</DialogTitle>
          <DialogDescription>
            This removes the ingredients, steps, and tags stored with this
            recipe.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={remove}
            disabled={pending}
          >
            {pending ? "Deleting" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteRecipe };
