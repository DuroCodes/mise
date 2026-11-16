import { CheckIcon, MonitorIcon, PaletteIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { DropdownMenu } from "radix-ui";
import { Button } from "@/components/ui/button";
import { themeOptions } from "@/lib/themes";

/** Picks a color theme; "System" follows the device's light or dark setting. */
function ThemeToggle() {
  const { theme = "system", setTheme } = useTheme();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="Choose a theme">
          <PaletteIcon />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-48 rounded-xl bg-popover p-1 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Theme
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={theme} onValueChange={setTheme}>
            {themeOptions.map((option) => (
              <DropdownMenu.RadioItem
                key={option.id}
                value={option.id}
                className="flex cursor-default items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none select-none data-[highlighted]:bg-muted"
              >
                {option.id === "system" ? (
                  <MonitorIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <span
                    className="flex size-4 items-center justify-center rounded-full ring-1 ring-foreground/20"
                    style={{ background: option.swatch[0] }}
                    aria-hidden="true"
                  >
                    <span className="size-1.5 rounded-full" style={{ background: option.swatch[1] }} />
                  </span>
                )}
                <span className="flex-1">{option.label}</span>
                <DropdownMenu.ItemIndicator>
                  <CheckIcon className="size-4" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export { ThemeToggle };
