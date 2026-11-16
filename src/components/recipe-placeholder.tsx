function RecipePlaceholder() {
  return (
    <div className="w-full space-y-8" aria-busy="true">
      <span className="sr-only">Loading recipe</span>
      <div className="space-y-3">
        <div className="h-8 w-48 max-w-full rounded-lg bg-muted" />
        <div className="h-4 w-full max-w-md rounded-lg bg-muted" />
      </div>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="h-4 w-24 rounded-lg bg-muted" />
          <div className="h-4 w-full rounded-lg bg-muted" />
          <div className="h-4 w-4/5 rounded-lg bg-muted" />
          <div className="h-4 w-2/3 rounded-lg bg-muted" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-24 rounded-lg bg-muted" />
          <div className="h-4 w-full rounded-lg bg-muted" />
          <div className="h-4 w-5/6 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}

export { RecipePlaceholder };
