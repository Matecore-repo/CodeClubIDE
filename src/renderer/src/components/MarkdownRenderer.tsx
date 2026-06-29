import { renderContent } from "../utils/markdown";

export function MarkdownRenderer({ content }: { content: string }) {
  return <>{renderContent(content)}</>;
}
