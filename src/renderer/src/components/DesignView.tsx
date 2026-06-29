import { CanvasPanel } from "./CanvasPanel";

export function DesignView({
  toolbarVisible,
  activeColor,
}: {
  toolbarVisible: boolean;
  activeColor?: string;
}) {
  return <CanvasPanel toolbarVisible={toolbarVisible} activeColor={activeColor} />;
}
