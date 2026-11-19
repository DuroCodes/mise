import {
  BellRingIcon,
  PauseIcon,
  PlayIcon,
  TimerIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { easeOut } from "@/lib/motion";
import {
  secondsLeft,
  TimerContext,
  type KitchenTimer,
} from "@/lib/timer-context";
import { syncTimer } from "@/lib/push";
import { formatClock } from "@/shared/timers";

let audio: AudioContext | null = null;

const unlockAudio = () => {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
};

const chime = () => {
  if (!audio) return;
  try {
    const start = audio.currentTime;
    for (let beep = 0; beep < 3; beep += 1) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      const at = start + beep * 0.45;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + 0.35);
    }
  } catch {
    // sound is a nicety; the visual alert still shows.
  }
};

function TimerProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const cooking = /\/cook\/?$/.test(pathname);
  const [timers, setTimers] = useState<KitchenTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const running = timers.some((timer) => timer.endsAt !== null);
  const ringing = timers.some((timer) => timer.done);
  const latest = useRef(timers);

  useEffect(() => {
    latest.current = timers;
  }, [timers]);

  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      const finished = latest.current.filter(
        (timer) => timer.endsAt !== null && timer.endsAt <= at
      );
      if (!finished.length) return;
      const ids = new Set(finished.map((timer) => timer.id));
      latest.current = latest.current.map((timer) =>
        ids.has(timer.id)
          ? { ...timer, endsAt: null, remaining: 0, done: true }
          : timer
      );
      setTimers(latest.current);
      // sound + the floating chip are enough; a toast just covers the chip.
      chime();
      try {
        navigator.vibrate?.([300, 150, 300]);
      } catch {
        // not every device can vibrate.
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [running]);

  useEffect(() => {
    if (!ringing) return;
    const again = window.setInterval(chime, 4000);
    return () => window.clearInterval(again);
  }, [ringing]);

  const api = {
    timers,
    now,
    start: (label: string, seconds: number, recipe: string | null = null) => {
      unlockAudio();
      const startedAt = Date.now();
      const id = crypto.randomUUID();
      setNow(startedAt);
      setTimers((current) => [
        ...current,
        {
          id,
          label,
          recipe,
          total: seconds,
          endsAt: startedAt + seconds * 1000,
          remaining: seconds,
          done: false,
        },
      ]);
      // also ring through a notification if the phone is locked.
      syncTimer("start", { id, label, recipe, seconds });
    },
    pause: (id: string) => {
      syncTimer("stop", { id, label: "", recipe: null });
      setTimers((current) =>
        current.map((timer) =>
          timer.id === id && timer.endsAt !== null
            ? {
                ...timer,
                remaining: secondsLeft(timer, Date.now()),
                endsAt: null,
              }
            : timer
        )
      );
    },
    resume: (id: string) => {
      unlockAudio();
      setNow(Date.now());
      const paused = latest.current.find(
        (timer) => timer.id === id && timer.endsAt === null && !timer.done
      );
      if (paused)
        syncTimer("start", {
          id,
          label: paused.label,
          recipe: paused.recipe,
          seconds: paused.remaining,
        });
      setTimers((current) =>
        current.map((timer) =>
          timer.id === id && timer.endsAt === null && !timer.done
            ? { ...timer, endsAt: Date.now() + timer.remaining * 1000 }
            : timer
        )
      );
    },
    remove: (id: string) => {
      const timer = latest.current.find((entry) => entry.id === id);
      if (timer && !timer.done)
        syncTimer("stop", { id, label: "", recipe: null });
      setTimers((current) => current.filter((entry) => entry.id !== id));
    },
  };

  return (
    <TimerContext.Provider value={api}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-4 z-60 flex w-auto flex-col items-stretch gap-2 sm:inset-x-auto sm:left-6 sm:w-max sm:max-w-[calc(100vw-3rem)] print:hidden",
          cooking
            ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-28"
            : "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-6"
        )}
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {timers.map((timer) => {
            const left = secondsLeft(timer, now);
            const paused = timer.endsAt === null && !timer.done;
            return (
              <motion.div
                key={timer.id}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: easeOut }}
                className={cn(
                  "pointer-events-auto flex w-full items-center gap-2 rounded-xl bg-popover py-1.5 pr-1.5 pl-3 text-sm shadow-lg ring-1 ring-foreground/10",
                  timer.done && "bg-brand text-background ring-brand"
                )}
              >
                {timer.done ? (
                  <BellRingIcon
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <TimerIcon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">
                    {timer.done ? "Done" : formatClock(left)}
                  </p>
                  <p
                    className={cn(
                      "max-w-48 truncate text-xs",
                      timer.done ? "opacity-90" : "text-muted-foreground"
                    )}
                  >
                    {timer.recipe ? `${timer.recipe} · ` : ""}
                    {timer.label}
                  </p>
                </div>
                {!timer.done && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={
                      paused ? `Resume ${timer.label}` : `Pause ${timer.label}`
                    }
                    onClick={() =>
                      paused ? api.resume(timer.id) : api.pause(timer.id)
                    }
                  >
                    {paused ? <PlayIcon /> : <PauseIcon />}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={
                    timer.done
                      ? "hover:bg-background/20 hover:text-background"
                      : undefined
                  }
                  aria-label={
                    timer.done
                      ? `Dismiss ${timer.label}`
                      : `Cancel ${timer.label}`
                  }
                  onClick={() => api.remove(timer.id)}
                >
                  <XIcon />
                </Button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </TimerContext.Provider>
  );
}

export { TimerProvider };
