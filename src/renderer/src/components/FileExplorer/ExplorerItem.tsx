import type { CSSProperties, HTMLAttributes, ButtonHTMLAttributes } from "react";

const ROW = 26;

const base: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  minHeight: ROW,
  padding: "3px 7px",
  fontSize: 13,
  border: "none",
  background: "transparent",
  width: "100%",
  textAlign: "left",
  boxSizing: "border-box",
  borderRadius: 6,
  cursor: "pointer",
  color: "#b9b9be",
  outline: "none",
};

export const iconStyle: CSSProperties = {
  width: 15,
  height: 15,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#a6a6aa",
};

export const labelStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const badgeStyle: CSSProperties = {
  minWidth: 12,
  padding: "0 1px",
  color: "#8a8a91",
  fontSize: 11,
  fontWeight: 600,
  textAlign: "right",
  flexShrink: 0,
};

interface ExplorerItemBase {
  active?: boolean;
  activeColor?: string;
  depth?: number;
  paddingLeft?: number;
}

type ExplorerItemAsDiv = ExplorerItemBase &
  Omit<HTMLAttributes<HTMLDivElement>, "color"> & { as?: "div" };

type ExplorerItemAsButton = ExplorerItemBase &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> & { as: "button" };

export type ExplorerItemProps = ExplorerItemAsDiv | ExplorerItemAsButton;

export function ExplorerItem(props: ExplorerItemProps) {
  const {
    active,
    activeColor,
    depth = 0,
    paddingLeft,
    as: Tag = "button",
    style,
    children,
    ...rest
  } = props;

  const pl = paddingLeft ?? 4 + depth * 14;
  const activeBg = `color-mix(in srgb, ${activeColor || "#1597f5"} 16%, #1b1b1b)`;

  const merged: CSSProperties = {
    ...base,
    paddingLeft: pl,
    background: active ? activeBg : "transparent",
    color: active ? "#f5f5f6" : "#b9b9be",
    ...style,
  };

  if (Tag === "div") {
    return (
      <div style={merged} {...(rest as HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }
  return (
    <button style={merged} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}

export function ExplorerIcon({ children, style, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span style={{ ...iconStyle, ...style }} {...rest}>
      {children}
    </span>
  );
}

export function ExplorerLabel({ children, style, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span style={{ ...labelStyle, ...style }} {...rest}>
      {children}
    </span>
  );
}

export function ExplorerBadge({ children, style, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span style={{ ...badgeStyle, ...style }} {...rest}>
      {children}
    </span>
  );
}
