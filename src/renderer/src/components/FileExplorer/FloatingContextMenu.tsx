import { s } from "./styles";

export interface FloatingContextMenuItem {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
}

export function FloatingContextMenu({
  x,
  y,
  items,
}: {
  x: number;
  y: number;
  items: FloatingContextMenuItem[];
}) {
  return (
    <div style={{ ...s.contextMenu, left: x, top: y }} onMouseDown={(e) => e.stopPropagation()}>
      {items.map((item, index) =>
        item.separator ? (
          <div key={index} style={s.menuSep} />
        ) : (
          <button
            key={index}
            style={{ ...s.menuItem, opacity: item.disabled ? 0.3 : 1 }}
            disabled={item.disabled}
            onMouseEnter={(e) => {
              if (!item.disabled) e.currentTarget.style.background = "var(--surface-base)";
            }}
            onMouseLeave={(e) => {
              if (!item.disabled) e.currentTarget.style.background = "transparent";
            }}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
