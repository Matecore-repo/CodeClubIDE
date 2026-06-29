import { useState, useEffect, useCallback } from "react";
import qrCode from "../assets/qrcode.webp";
import chillBg from "../assets/chill.webp";

const KOFI_URL = "https://ko-fi.com/codeclubide";

export function DonationBanner(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const handler = () => {
      setExiting(false);
      setVisible(true);
    };
    window.addEventListener("codeclub:show-donation-banner", handler);
    return () => window.removeEventListener("codeclub:show-donation-banner", handler);
  }, []);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => setVisible(false), 300);
  }, []);

  const handleDonate = useCallback(() => {
    window.api.openLink(KOFI_URL);
    setExiting(true);
    setTimeout(() => setVisible(false), 300);
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.3s ease",
      }}
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          borderRadius: 16,
          boxShadow: "0 14px 40px rgba(0,0,0,0.7)",
          background: "#121214",
          border: "1px solid #242428",
          maxWidth: 500,
          width: "90%",
          overflow: "hidden",
        }}
      >
        <img
          src={chillBg}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(4px) brightness(0.4)",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "28px 32px",
            display: "flex",
            alignItems: "center",
            gap: 24,
            color: "#f0e6d8",
            textAlign: "left" as const,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Code Club</div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.8)",
                marginBottom: 16,
              }}
            >
              We are developers from Argentina building an offline tool with no corporate ties. We
              maintain this project with pure passion and mate. Your support helps us keep coding,
              improve the tool, and keep the IDE truly free for everyone. Thanks for having our
              backs!
            </div>
            <a
              onClick={handleDonate}
              style={{
                color: "#e0895e",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              Support the project
            </a>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <img
              src={qrCode}
              alt="Ko-fi QR"
              style={{
                width: 130,
                height: 130,
                borderRadius: 8,
                cursor: "pointer",
                marginBottom: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
              onClick={handleDonate}
            />
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              ko-fi.com/codeclubide
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
