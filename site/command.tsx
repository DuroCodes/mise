import { useState } from "react";
import { Button } from "@/components/ui/button";

function Command({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="command">
      <pre>
        <code>{code}</code>
      </pre>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute top-2 right-2"
        onClick={() => void copy()}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export { Command };
