import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { easeOut } from "@/lib/motion";

type ShoppingRowItem = {
  id: string;
  name: string;
  amount: string;
  unit: string;
  note: string;
  sources: string[];
  checked: boolean;
};

const quantity = (item: ShoppingRowItem) =>
  [item.amount, item.unit].filter(Boolean).join(" ");

const isOptional = (note: string) => /\boptional\b/i.test(note);

/** the note without the word "optional", which gets its own tag. */
const cleanNote = (note: string) =>
  note
    .replace(/\(?\boptional\b\)?[,;:]?\s*/i, "")
    .replace(/^[\s,;:()-]+|[\s,;:()]+$/g, "")
    .trim();

function ShoppingRow({
  item,
  showSources,
  onToggle,
  onEdit,
  onRemove,
}: {
  item: ShoppingRowItem;
  showSources: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const optional = isOptional(item.note);
  const note = cleanNote(item.note);
  const details = [note, showSources ? item.sources.join(", ") : ""]
    .filter(Boolean)
    .join(", ");
  const local = item.id.startsWith("local-");
  const measure = quantity(item);

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="flex items-center"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        onClick={onToggle}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pr-1 pl-3 text-left outline-none focus-visible:bg-muted/60 sm:pl-4"
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
            item.checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input"
          )}
          aria-hidden="true"
        >
          {item.checked && <CheckIcon className="size-3.5" strokeWidth={3} />}
        </span>
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-0.5 text-[0.95rem] leading-6 sm:flex-row sm:items-baseline sm:gap-x-3",
            item.checked && "text-muted-foreground line-through"
          )}
        >
          <span className="min-w-0 truncate sm:flex-1">
            {measure && (
              <span className="font-medium tabular-nums">{measure} </span>
            )}
            <span>{item.name}</span>
            {optional && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[0.7rem] leading-5 font-medium text-muted-foreground no-underline">
                optional
              </span>
            )}
          </span>
          {details && (
            <span className="truncate text-xs text-muted-foreground no-underline sm:max-w-[42%] sm:shrink-0 sm:text-right">
              {details}
            </span>
          )}
        </span>
      </button>
      {onEdit && !local && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground"
          aria-label={`Edit ${item.name}`}
          onClick={onEdit}
        >
          <PencilIcon />
        </Button>
      )}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mr-1.5 shrink-0 text-muted-foreground sm:mr-2"
          aria-label={`Remove ${item.name}`}
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      )}
    </motion.li>
  );
}

export { ShoppingRow, type ShoppingRowItem };
