import { useEffect, useState, type SubmitEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { KeyRoundIcon, PencilIcon, TrashIcon } from "lucide-react";
import { BackupPanel } from "@/components/backup-panel";
import { AiPanel } from "@/components/ai-panel";
import { InvitePanel } from "@/components/invite-panel";
import { InlineError } from "@/components/inline-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addPerson,
  listAdminRecipes,
  listPeople,
  removePerson,
  removeRecipe,
  updatePerson,
  type Account,
  type AdminRecipe,
} from "@/lib/api";
import { match } from "@/lib/result";
import { useTitle } from "@/lib/use-title";
import { Skeleton } from "@/components/ui/skeleton";

/** Gray table rows shown while a table's data loads. */
function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return Array.from({ length: rows }, (_, index) => (
    <TableRow key={index} aria-hidden="true">
      <TableCell colSpan={4}>
        <Skeleton className="h-6 w-full" />
      </TableCell>
    </TableRow>
  ));
}

function AdminPage({ selfId }: { selfId: string }) {
  const [people, setPeople] = useState<Account[] | null>(null);
  const [recipes, setRecipes] = useState<AdminRecipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<Account | null>(null);
  const [resetAccount, setResetAccount] = useState<Account | null>(null);
  const [nextPassword, setNextPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useTitle("Admin · Mise");

  useEffect(() => {
    let active = true;
    Promise.all([listPeople(), listAdminRecipes()]).then(
      ([accounts, catalog]) => {
        if (!active) return;
        if (!accounts.ok) {
          setError(accounts.error);
          return;
        }
        if (!catalog.ok) {
          setError(catalog.error);
          return;
        }
        setPeople(accounts.value);
        setRecipes(catalog.value);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    const result = await addPerson({ name, email, password });
    match(
      result,
      (value) => {
        setPeople(value);
        setName("");
        setEmail("");
        setPassword("");
        setPending(false);
        setAdding(false);
      },
      (message) => {
        setFormError(message);
        setPending(false);
      }
    );
  };

  const changeRole = async (person: Account, next: "admin" | "member") => {
    if (next === person.role) return;
    const result = await updatePerson(person.id, { role: next });
    match(
      result,
      (value) => setPeople(value),
      (message) => toast.error(message)
    );
  };

  const openReset = (person: Account) => {
    setResetAccount(person);
    setResetting(person);
    setNextPassword("");
    setResetError(null);
  };

  const savePassword = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetAccount) return;
    const next = nextPassword.trim();
    if (next.length < 8) {
      setResetError("Use at least 8 characters");
      return;
    }
    setSaving(true);
    setResetError(null);
    const result = await updatePerson(resetAccount.id, { password: next });
    match(
      result,
      (value) => {
        setPeople(value);
        setResetting(null);
        setSaving(false);
      },
      (message) => {
        setResetError(message);
        setSaving(false);
      }
    );
  };

  const removeAccount = async (id: string) => {
    const result = await removePerson(id);
    match(
      result,
      () =>
        setPeople(
          (current) => current?.filter((person) => person.id !== id) ?? current
        ),
      (message) => toast.error(message)
    );
  };

  const remove = async (id: string) => {
    const result = await removeRecipe(id);
    match(
      result,
      () =>
        setRecipes(
          (current) => current?.filter((recipe) => recipe.id !== id) ?? current
        ),
      (message) => toast.error(message)
    );
  };

  if (error) {
    return (
      <div className="space-y-2 py-10">
        <h1 className="text-2xl font-medium tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-medium tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Accounts and every recipe, including private ones.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-medium tracking-tight">Accounts</h2>
          <Button type="button" onClick={() => setAdding(true)}>
            Add account
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people === null && <SkeletonRows />}
            {(people ?? []).map((person) => (
              <TableRow key={person.id}>
                <TableCell className="font-medium">{person.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {person.email}
                </TableCell>
                <TableCell>
                  <Select
                    value={person.role === "admin" ? "admin" : "member"}
                    disabled={person.id === selfId}
                    onValueChange={(next) => {
                      if (next === "admin" || next === "member")
                        changeRole(person, next);
                    }}
                  >
                    <SelectTrigger
                      aria-label={`Role for ${person.name}`}
                      className="w-32"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Reset password for ${person.name}`}
                      onClick={() => openReset(person)}
                    >
                      <KeyRoundIcon />
                    </Button>
                    {person.id !== selfId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Remove ${person.name}`}
                        onClick={() => removeAccount(person.id)}
                      >
                        <TrashIcon />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium tracking-tight">Recipes</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipe</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipes === null && <SkeletonRows />}
            {(recipes ?? []).map((recipe) => (
              <TableRow key={recipe.id}>
                <TableCell className="font-medium">
                  <Link
                    to={`/recipes/${recipe.id}`}
                    className="hover:underline"
                  >
                    {recipe.title}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">
                  {recipe.visibility}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {recipe.ownerName ?? "No owner"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="outline" size="icon-sm">
                      <Link
                        to={`/recipes/${recipe.id}/edit`}
                        aria-label={`Edit ${recipe.title}`}
                      >
                        <PencilIcon />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Delete ${recipe.title}`}
                      onClick={() => remove(recipe.id)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {recipes?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No recipes yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <InvitePanel />

      <AiPanel />

      <BackupPanel />

      <Dialog
        open={adding}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setAdding(false);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="person-name">Name</Label>
                <Input
                  id="person-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="person-email">Email</Label>
                <Input
                  id="person-email"
                  type="email"
                  value={email}
                  autoComplete="off"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-password">Password</Label>
              <Input
                id="person-password"
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Adding" : "Add account"}
              </Button>
              <InlineError message={formError} />
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetting !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setResetting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {resetAccount?.name}</DialogTitle>
          </DialogHeader>
          {resetAccount && (
            <form onSubmit={savePassword} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="account-password">New password</Label>
                <Input
                  id="account-password"
                  type="password"
                  value={nextPassword}
                  autoComplete="new-password"
                  onChange={(event) => setNextPassword(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving" : "Save"}
                </Button>
                <InlineError message={resetError} />
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { AdminPage };
