"use client";

import { useState, FormEvent } from "react";

export default function DemoPage() {
  const [name, setName] = useState("");
  const [clinic, setClinic] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Demo request from ${name} — ${clinic}`);
    const body = encodeURIComponent(
      `Name: ${name}\nClinic: ${clinic}\nEmail: ${email}\nPhone: ${phone || "—"}`
    );
    window.location.href = `mailto:kayna@lluna.ai?subject=${subject}&body=${body}`;
    setSent(true);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    fontSize: 15,
    border: "1px solid #D1D5DB",
    borderRadius: 8,
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#0A0A0A",
    backgroundColor: "#FFFFFF",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    marginBottom: 6,
  };

  return (
    <main
      style={{
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        backgroundColor: "#FFFFFF",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        color: "#0A0A0A",
      }}
    >
      {/* Nav back link */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          borderBottom: "1px solid #E5E7EB",
          backgroundColor: "#FFFFFF",
          height: 60,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
        }}
      >
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "#0A0A0A",
          }}
        >
          <img
            src="/lluna-logo.png"
            alt="Lluna"
            style={{ height: 26, width: 26, objectFit: "contain" }}
          />
          <span style={{ fontWeight: 700, fontSize: 17 }}>Lluna</span>
        </a>
      </div>

      <div style={{ maxWidth: 480, width: "100%" }}>
        {sent ? (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <div
              style={{
                width: 56,
                height: 56,
                backgroundColor: "#F0FDF4",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                fontSize: 28,
              }}
            >
              ✓
            </div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                marginBottom: 12,
              }}
            >
              Message sent!
            </h1>
            <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.65 }}>
              We&apos;ll be in touch within 24 hours. Check your email client if
              the window didn&apos;t open automatically.
            </p>
            <a
              href="/"
              style={{
                display: "inline-block",
                marginTop: 32,
                color: "#111827",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              ← Back to home
            </a>
          </div>
        ) : (
          <>
            <h1
              style={{
                fontSize: "clamp(36px, 6vw, 52px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              Let&apos;s talk.
            </h1>
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.65,
                color: "#374151",
                textAlign: "center",
                marginBottom: 48,
              }}
            >
              Tell us about your clinic and we&apos;ll be in touch within 24 hours.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label htmlFor="name" style={labelStyle}>
                  Name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="clinic" style={labelStyle}>
                  Clinic Name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  id="clinic"
                  type="text"
                  required
                  placeholder="The Aesthetic Studio"
                  value={clinic}
                  onChange={(e) => setClinic(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="email" style={labelStyle}>
                  Email <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="jane@yourclinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="phone" style={labelStyle}>
                  Phone{" "}
                  <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+44 7700 900 000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                style={{
                  backgroundColor: "#111827",
                  color: "#FFFFFF",
                  padding: "14px 24px",
                  fontSize: 16,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  marginTop: 8,
                  fontFamily: "Inter, system-ui, sans-serif",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLElement).style.backgroundColor = "#1F2937")
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLElement).style.backgroundColor = "#111827")
                }
              >
                Send message
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
