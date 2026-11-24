import { FileCodeIcon, TerminalIcon } from "lucide-react";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";

function Command({
  code,
  title = "Terminal",
  language = "bash",
}: {
  code: string;
  title?: string;
  language?: string;
}) {
  const lines = useHighlightedCode(code, language);
  const Icon = language === "yaml" ? FileCodeIcon : TerminalIcon;

  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <Icon />
          {title}
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent wrap>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}

export { Command };
