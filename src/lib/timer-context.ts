import { createContext, useContext } from "react";

export type KitchenTimer = {
  id: string;
  label: string;
  recipe: string | null;
  total: number;
  /** Epoch ms when a running timer ends; null while paused or done. */
  endsAt: number | null;
  /** seconds left, kept while paused. */
  remaining: number;
  done: boolean;
};

export type TimerApi = {
  timers: KitchenTimer[];
  now: number;
  start: (label: string, seconds: number, recipe?: string | null) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  remove: (id: string) => void;
};

export const TimerContext = createContext<TimerApi | null>(null);

export const useTimers = () => {
  const value = useContext(TimerContext);
  if (!value) throw new Error("useTimers needs a TimerProvider");
  return value;
};

export const secondsLeft = (timer: KitchenTimer, now: number) =>
  timer.done
    ? 0
    : timer.endsAt === null
      ? timer.remaining
      : Math.max(0, (timer.endsAt - now) / 1000);
