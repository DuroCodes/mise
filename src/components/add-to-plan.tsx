import { CalendarPlusIcon } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { addPlanEntry, mealSlots, slotLabel, type MealSlot } from "@/lib/api";
import { localDay } from "@/lib/view";

function AddToPlan({
  recipeId,
  servings,
}: {
  recipeId: string;
  servings: number | null;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(localDay);
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setError("Pick a date");
      return;
    }
    setPending(true);
    setError(null);
    const result = await addPlanEntry({
      day,
      slot,
      recipeId,
      servings: servings && Number.isInteger(servings) ? servings : null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    toast.success("Added to the meal plan", {
      action: { label: "View", onClick: () => navigate(`/plan?week=${day}`) },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <CalendarPlusIcon data-icon="inline-start" />
          Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to the meal plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan-day">Day</Label>
              <Input
                id="plan-day"
                type="date"
                value={day}
                onChange={(event) => setDay(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-slot">Meal</Label>
              <Select
                value={slot}
                onValueChange={(value) => setSlot(value as MealSlot)}
              >
                <SelectTrigger id="plan-slot" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mealSlots.map((item) => (
                    <SelectItem key={item} value={item}>
                      {slotLabel[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="sm:justify-between">
            <Button asChild variant="ghost" type="button">
              <Link to="/plan">Open the planner</Link>
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { AddToPlan };
