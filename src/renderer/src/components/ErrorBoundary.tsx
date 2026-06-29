import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            background: "#111111",
            color: "#bdbdc3",
            fontFamily: "system-ui, sans-serif",
            padding: 24,
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: "#df3138" }}>
            Something went wrong
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#777780",
              maxWidth: 520,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {this.state.error?.message || "An unexpected rendering error occurred."}
          </div>
          <button
            style={{
              marginTop: 8,
              height: 30,
              padding: "0 16px",
              border: "1px solid #252529",
              borderRadius: 6,
              background: "#151516",
              color: "#bdbdc3",
              fontSize: 12,
              cursor: "pointer",
            }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
