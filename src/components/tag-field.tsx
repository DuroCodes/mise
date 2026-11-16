import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { listTags } from "@/lib/api";
import { cn } from "cn";

const clean = (value: string) => value.trim().replace(/\s+/g, " ");

const sameTag = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

function TagField({
  tags,
  draft,
  onTags,
  onDraft,
}: {
  tags: string[];
  draft: string;
  onTags: (tags: string[]) => void;
  onDraft: (draft: string) => void;
}) {
  const listId = useId();
  const [known, setKnown] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    listTags().then((result) => {
      if (current && result.ok) setKnown(result.value);
    });
    return () => {
      current = false;
    };
  }, []);

  const query = clean(draft).toLowerCase();
  const unused = known.filter(
    (tag) => !tags.some((item) => sameTag(item, tag))
  );
  const suggestions = (
    query ? unused.filter((tag) => tag.toLowerCase().includes(query)) : unused
  ).sort((left, right) => {
    const leftStart = query && left.toLowerCase().startsWith(query) ? 0 : 1;
    const rightStart = query && right.toLowerCase().startsWith(query) ? 0 : 1;
    if (leftStart !== rightStart) return leftStart - rightStart;
    return left.localeCompare(right);
  });

  const showing = open && suggestions.length > 0;
  const highlighted =
    active !== null && active < suggestions.length ? active : null;

  const add = (value: string) => {
    const name = clean(value);
    if (!name) return;
    const existing = known.find((tag) => sameTag(tag, name)) ?? name;
    if (!tags.some((tag) => sameTag(tag, existing)))
      onTags([...tags, existing]);
    onDraft("");
    setActive(null);
    setOpen(true);
  };

  return (
    <div className="relative">
      <Input
        id="tag"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showing}
        aria-controls={showing ? listId : undefined}
        aria-activedescendant={
          highlighted !== null ? `${listId}-${highlighted}` : undefined
        }
        autoComplete="off"
        value={draft}
        placeholder="Add a tag and press enter"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          onDraft(event.target.value);
          setActive(null);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setActive(null);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!suggestions.length) return;
            setOpen(true);
            const last = suggestions.length - 1;
            setActive((current) => {
              if (current === null || current >= suggestions.length) {
                return event.key === "ArrowDown" ? 0 : last;
              }
              if (event.key === "ArrowDown")
                return current === last ? 0 : current + 1;
              return current === 0 ? last : current - 1;
            });
            return;
          }
          if (event.key !== "Enter" && event.key !== ",") return;
          event.preventDefault();
          if (showing && highlighted !== null) add(suggestions[highlighted]);
          else add(draft);
        }}
      />
      {showing && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Used tags"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg bg-popover p-1 text-popover-foreground ring-1 ring-foreground/10"
        >
          {suggestions.map((tag, index) => (
            <li key={tag} role="presentation">
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === highlighted}
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left text-sm",
                  index === highlighted && "bg-accent text-accent-foreground"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => add(tag)}
                ref={(node) => {
                  if (index === highlighted)
                    node?.scrollIntoView({ block: "nearest" });
                }}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { TagField };
