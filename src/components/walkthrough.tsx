import {
  AppleIcon,
  ArchiveIcon,
  ArrowRightIcon,
  CheckIcon,
  FolderIcon,
  Link2Icon,
  LinkIcon,
  PaletteIcon,
  PauseIcon,
  ScanBarcodeIcon,
  StarIcon,
  TimerIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { StepText } from "@/components/step-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { easeOut, leave, rise } from "@/lib/motion";
import {
  secondsLeft,
  TimerContext,
  type KitchenTimer,
} from "@/lib/timer-context";
import {
  markWalkthroughSeen,
  onOpenWalkthrough,
  walkthroughSeen,
} from "@/lib/walkthrough";
import { formatClock } from "@/shared/timers";

/** steps through `durations` once, then holds on the last phase. */
function useSequence(durations: readonly number[]) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (phase >= durations.length) return;
    const id = window.setTimeout(() => setPhase(phase + 1), durations[phase]);
    return () => window.clearTimeout(id);
  }, [phase, durations]);
  return phase;
}

const pop = (delay: number) => ({
  initial: { opacity: 0, y: 8, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.4, ease: easeOut, delay },
});

function MiniCard({
  title,
  tone,
  className,
}: {
  title: string;
  tone: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-24 space-y-1.5 rounded-lg bg-card p-1.5 shadow-sm ring-1 ring-foreground/10",
        className
      )}
    >
      <div className={cn("h-14 rounded-md", tone)} />
      <p className="truncate px-0.5 text-[10px] font-medium">{title}</p>
      <div className="mx-0.5 h-1 w-2/3 rounded-full bg-foreground/10" />
    </div>
  );
}

function WelcomeScene() {
  const cards = [
    { title: "Shakshuka", tone: "bg-chart-2", x: -68, rotate: -9 },
    { title: "Lemon cake", tone: "bg-chart-4", x: 68, rotate: 9 },
    { title: "Garlic noodles", tone: "bg-brand", x: 0, rotate: 0 },
  ];
  return (
    <div className="absolute inset-0 grid place-items-center">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          className="absolute"
          initial={{ opacity: 0, y: 28, x: 0, rotate: 0 }}
          animate={{ opacity: 1, y: 0, x: card.x, rotate: card.rotate }}
          transition={{ duration: 0.7, ease: easeOut, delay: 0.1 * index }}
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{
              duration: 3.2,
              ease: "easeInOut",
              repeat: Infinity,
              delay: 0.8 + index * 0.5,
            }}
          >
            <MiniCard title={card.title} tone={card.tone} />
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

const importTimes = [500, 1000] as const;

function ImportScene() {
  const phase = useSequence(importTimes);
  const ingredients = ["200g noodles", "6 cloves garlic", "2 tbsp butter"];
  return (
    <div className="absolute inset-0 flex flex-col items-center gap-3 px-6 pt-5">
      <div className="flex w-full items-center gap-2 rounded-lg bg-card px-2.5 py-2 text-[11px] ring-1 ring-foreground/10">
        <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
        <motion.span
          className="min-w-0 overflow-hidden whitespace-nowrap"
          initial={{ width: 0 }}
          animate={{ width: phase >= 1 ? "auto" : 0 }}
          transition={{ duration: 0.8, ease: "linear" }}
        >
          tiktok.com/@nonna/garlic-noodles
        </motion.span>
        <motion.span
          className="-ml-1.5 h-3 w-px shrink-0 bg-foreground/60"
          animate={{ opacity: phase >= 2 ? 0 : [1, 0, 1] }}
          transition={{ duration: 0.9, repeat: phase >= 2 ? 0 : Infinity }}
        />
      </div>
      <AnimatePresence>
        {phase >= 2 && (
          <motion.div
            className="flex w-full gap-2.5 rounded-lg bg-card p-2 shadow-sm ring-1 ring-foreground/10"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: easeOut }}
          >
            <div className="w-16 shrink-0 rounded-md bg-brand" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium">Garlic noodles</p>
              <p className="text-[10px] text-muted-foreground">
                20 min · 2 servings
              </p>
              <ul className="pt-1">
                {ingredients.map((item, index) => (
                  <motion.li
                    key={item}
                    className="flex items-center gap-1.5 text-[10px]"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.3,
                      ease: easeOut,
                      delay: 0.25 + index * 0.12,
                    }}
                  >
                    <span className="size-1 rounded-full bg-brand" />
                    {item}
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const cookStep = "Simmer for 10 minutes until the sauce thickens.";
const cookTimes = [1100] as const;

/** same chip as timer-provider, sized for the walkthrough card. */
function SceneTimerChip({
  timer,
  now,
}: {
  timer: KitchenTimer;
  now: number;
}) {
  const left = secondsLeft(timer, now);
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: easeOut }}
      className="flex w-full items-center gap-2 rounded-xl bg-popover py-1.5 pr-1.5 pl-3 text-sm shadow-lg ring-1 ring-foreground/10"
    >
      <TimerIcon
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium tabular-nums">{formatClock(left)}</p>
        <p className="max-w-48 truncate text-xs text-muted-foreground">
          {timer.recipe ? `${timer.recipe} · ` : ""}
          {timer.label}
        </p>
      </div>
      <span className="grid size-7 place-items-center text-muted-foreground">
        <PauseIcon className="size-4" aria-hidden="true" />
      </span>
      <span className="grid size-7 place-items-center text-muted-foreground">
        <XIcon className="size-4" aria-hidden="true" />
      </span>
    </motion.div>
  );
}

function CookScene() {
  const phase = useSequence(cookTimes);
  const [timers, setTimers] = useState<KitchenTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const started = useRef(false);

  const api = {
    timers,
    now,
    start: (label: string, seconds: number, recipe: string | null = null) => {
      const startedAt = Date.now();
      setNow(startedAt);
      setTimers([
        {
          id: "walkthrough-timer",
          label,
          recipe,
          total: seconds,
          endsAt: startedAt + seconds * 1000,
          remaining: seconds,
          done: false,
        },
      ]);
    },
    pause: (_id: string) => {},
    resume: (_id: string) => {},
    remove: () => setTimers([]),
  };

  useEffect(() => {
    if (phase < 1 || started.current) return;
    started.current = true;
    const startedAt = Date.now();
    setNow(startedAt);
    setTimers([
      {
        id: "walkthrough-timer",
        label: "Step 2: 10 minutes",
        recipe: "Garlic noodles",
        total: 600,
        endsAt: startedAt + 600_000,
        remaining: 600,
        done: false,
      },
    ]);
  }, [phase]);

  useEffect(() => {
    if (!timers.some((timer) => timer.endsAt !== null)) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timers]);

  return (
    <TimerContext.Provider value={api}>
      <div className="absolute inset-0 flex flex-col px-5 pt-5">
        <motion.div className="space-y-2" {...pop(0.1)}>
          <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
            Step 2 of 4
          </p>
          <p className="text-[15px] leading-snug text-balance">
            <StepText
              text={cookStep}
              step={2}
              recipe="Garlic noodles"
              large
            />
          </p>
        </motion.div>
        <div className="mt-auto space-y-2 pb-3">
          <AnimatePresence initial={false}>
            {timers.map((timer) => (
              <SceneTimerChip key={timer.id} timer={timer} now={now} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </TimerContext.Provider>
  );
}

const planDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const planTimes = [450, 650] as const;

function PlanScene() {
  const phase = useSequence(planTimes);
  const planned: Record<number, { title: string; tone: string; at: number }> = {
    0: { title: "Tacos", tone: "bg-chart-3", at: 0 },
    2: { title: "Noodles", tone: "bg-brand", at: 1 },
    4: { title: "Shakshuka", tone: "bg-chart-2", at: 2 },
  };
  return (
    <div className="absolute inset-0 grid grid-cols-5 gap-1.5 px-4 pt-5">
      {planDays.map((day, index) => {
        const meal = planned[index];
        const shown = meal && phase >= meal.at;
        return (
          <div key={day} className="space-y-1.5">
            <p className="text-center text-[10px] text-muted-foreground">
              {day}
            </p>
            <div
              className={cn(
                "h-28 rounded-md border border-dashed border-foreground/15 p-1 transition-colors duration-500",
                shown && meal.at > 0 && "border-brand/50 bg-brand/5"
              )}
            >
              {shown && (
                <motion.div
                  className="space-y-1 rounded-md bg-card p-1 shadow-sm ring-1 ring-foreground/10"
                  initial={
                    meal.at === 0
                      ? false
                      : { opacity: 0, y: -70, rotate: -6, scale: 1.08 }
                  }
                  animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22 }}
                >
                  <div className={cn("h-8 rounded-sm", meal.tone)} />
                  <p className="truncate text-[9px] font-medium">
                    {meal.title}
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const shopTimes = [1200, 800, 600] as const;

function ShopRow({
  done,
  measure,
  name,
  note,
}: {
  done: boolean;
  measure: string;
  name: string;
  note: string;
}) {
  return (
    <motion.li
      layout
      className="flex items-center gap-2 overflow-hidden py-1 pl-0.5"
      exit={{
        opacity: 0,
        height: 0,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      }}
      transition={{ duration: 0.35, ease: easeOut }}
    >
      <span
        className={cn(
          "grid size-3.5 shrink-0 place-items-center rounded-full ring-1 transition-colors duration-200",
          done ? "bg-brand text-background ring-brand" : "ring-foreground/25"
        )}
      >
        {done && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25, ease: easeOut }}
          >
            <CheckIcon className="size-2.5" strokeWidth={3} />
          </motion.span>
        )}
      </span>
      <motion.span
        key={`${measure}-${name}`}
        className={cn(
          "min-w-0 flex-1 transition-colors duration-200",
          done && "text-muted-foreground line-through"
        )}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
      >
        <span className="block truncate text-[11px]">
          {measure && (
            <span className="font-medium tabular-nums">{measure} </span>
          )}
          <span>{name}</span>
        </span>
        {note && (
          <span className="block truncate text-[10px] text-muted-foreground no-underline">
            {note}
          </span>
        )}
      </motion.span>
    </motion.li>
  );
}

function ShopScene() {
  const phase = useSequence(shopTimes);
  const merged = phase >= 1;
  const eggs = merged
    ? [
        {
          id: "eggs",
          measure: "5",
          name: "eggs",
          note: "Shakshuka, Fried rice",
        },
      ]
    : [
        { id: "eggs", measure: "2", name: "eggs", note: "Shakshuka" },
        { id: "eggs-2", measure: "3", name: "eggs", note: "Fried rice" },
      ];
  const groups = [
    {
      name: "Produce",
      rows: [
        {
          id: "basil",
          measure: "1 bunch",
          name: "Basil",
          note: "Pesto pasta",
          done: phase >= 2,
        },
        {
          id: "garlic",
          measure: "4 cloves",
          name: "Garlic",
          note: "Garlic noodles",
          done: phase >= 3,
        },
      ],
    },
    {
      name: "Dairy & Eggs",
      rows: eggs.map((row) => ({ ...row, done: phase >= 3 })),
    },
  ];
  return (
    <div className="absolute inset-0 space-y-2.5 px-6 pt-6">
      {groups.map((group) => (
        <div key={group.name}>
          <p className="text-[10px] font-medium text-muted-foreground">
            {group.name}
          </p>
          <ul>
            <AnimatePresence initial={false}>
              {group.rows.map((row) => (
                <ShopRow
                  key={row.id}
                  done={row.done}
                  measure={row.measure}
                  name={row.name}
                  note={row.note}
                />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      ))}
    </div>
  );
}

function PantryScene() {
  const pantry = ["Rice", "Eggs", "Garlic", "Scallions", "Soy sauce"];
  const matches = [
    { title: "Fried rice", have: 5, of: 5 },
    { title: "Shakshuka", have: 3, of: 4 },
    { title: "Pad thai", have: 3, of: 7 },
  ];
  return (
    <div className="absolute inset-0 space-y-4 px-6 pt-5">
      <div className="flex flex-wrap justify-center gap-1">
        {pantry.map((item, index) => (
          <motion.span
            key={item}
            className="rounded-full bg-card px-2 py-0.5 text-[10px] ring-1 ring-foreground/10"
            {...pop(index * 0.07)}
          >
            {item}
          </motion.span>
        ))}
      </div>
      <ul className="space-y-2">
        {matches.map((match, index) => (
          <motion.li
            key={match.title}
            className="space-y-1"
            {...pop(0.5 + index * 0.1)}
          >
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="font-medium">{match.title}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {match.have} of {match.of}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
              <motion.div
                className="h-full rounded-full bg-brand"
                initial={{ width: "0%" }}
                animate={{ width: `${(match.have / match.of) * 100}%` }}
                transition={{
                  duration: 0.8,
                  ease: easeOut,
                  delay: 0.8 + index * 0.12,
                }}
              />
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

const extras = [
  { label: "Timers", icon: TimerIcon },
  { label: "Scan & shop", icon: ScanBarcodeIcon },
  { label: "Collections", icon: FolderIcon },
  { label: "Ratings", icon: StarIcon },
  { label: "Share links", icon: Link2Icon },
  { label: "Works offline", icon: WifiOffIcon },
  { label: "Themes", icon: PaletteIcon },
  { label: "Nutrition", icon: AppleIcon },
  { label: "Backups", icon: ArchiveIcon },
];

function MoreScene() {
  return (
    <div className="absolute inset-0 grid grid-cols-3 content-center gap-1.5 px-4">
      {extras.map(({ label, icon: Icon }, index) => (
        <motion.div
          key={label}
          className="flex flex-col items-center gap-1 rounded-lg bg-card py-2 ring-1 ring-foreground/10"
          {...pop(index * 0.05)}
        >
          <Icon className="size-4 text-brand" />
          <span className="text-[10px] font-medium">{label}</span>
        </motion.div>
      ))}
    </div>
  );
}

const steps = [
  {
    title: "Welcome to Mise",
    body: "Your recipes, meal plan, and groceries in one place. Here's a quick look around.",
    scene: WelcomeScene,
  },
  {
    title: "Import from anywhere",
    body: "Paste a link from a recipe site, TikTok, or Instagram. Mise pulls out the recipe.",
    scene: ImportScene,
  },
  {
    title: "Cook mode",
    body: "One step at a time, screen stays on. Tap a time to start a timer.",
    scene: CookScene,
  },
  {
    title: "Plan your week",
    body: "Drag recipes onto days. Add the whole week to your list in one tap.",
    scene: PlanScene,
  },
  {
    title: "A smarter list",
    body: "Matching ingredients add up across recipes and sort by aisle.",
    scene: ShopScene,
  },
  {
    title: "Use what you have",
    body: "Track your pantry and see which recipes you can make right now.",
    scene: PantryScene,
  },
  {
    title: "And more",
    body: "A few other things worth finding as you go.",
    scene: MoreScene,
  },
];

const slide = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 28 }),
  center: { opacity: 1, x: 0, transition: rise },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -28,
    transition: leave,
  }),
};

function Walkthrough({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(() => !walkthroughSeen(accountId));
  const [[index, direction], setPage] = useState([0, 0]);
  const next = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      onOpenWalkthrough(() => {
        setPage([0, 0]);
        setOpen(true);
      }),
    []
  );

  const close = () => {
    markWalkthroughSeen(accountId);
    setOpen(false);
  };
  const go = (to: number) => {
    if (to < 0 || to >= steps.length || to === index) return;
    setPage([to, to > index ? 1 : -1]);
  };

  const step = steps[index];
  const Scene = step.scene;
  const last = index === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent
        className="gap-0 overflow-x-hidden p-0 sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          next.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") go(index + 1);
          if (event.key === "ArrowLeft") go(index - 1);
        }}
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <motion.div
              className="cursor-grab p-3 pb-0 active:cursor-grabbing"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(_, info) => {
                if (info.offset.x < -48) go(index + 1);
                else if (info.offset.x > 48) go(index - 1);
              }}
            >
              <div
                aria-hidden
                className="relative h-48 overflow-hidden rounded-lg bg-muted select-none"
              >
                <Scene />
              </div>
            </motion.div>
            <div className="min-h-[5.25rem] space-y-1.5 px-5 pt-4">
              <DialogTitle>{step.title}</DialogTitle>
              <DialogDescription>{step.body}</DialogDescription>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="flex items-center justify-between gap-3 px-5 pt-2 pb-5">
          <div className="flex items-center">
            {steps.map((item, dot) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Step ${dot + 1}: ${item.title}`}
                aria-current={dot === index ? "step" : undefined}
                onClick={() => go(dot)}
                className="group grid h-6 place-items-center px-0.75 outline-none"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-focus-visible:ring-2 group-focus-visible:ring-ring",
                    dot === index
                      ? "w-4 bg-foreground"
                      : "w-1.5 bg-foreground/20 group-hover:bg-foreground/40"
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="ghost" onClick={() => go(index - 1)}>
                Back
              </Button>
            )}
            <Button ref={next} onClick={() => (last ? close() : go(index + 1))}>
              {last ? "Get started" : "Next"}
              {!last && <ArrowRightIcon data-icon="inline-end" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { Walkthrough };
