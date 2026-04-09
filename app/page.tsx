"use client";

import { useState, useEffect } from "react";
import { Menu, X, Check } from "lucide-react";

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main
      style={{
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        backgroundColor: "#FFFFFF",
        color: "#0A0A0A",
        overflowX: "hidden",
      }}
    >
      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: isScrolled ? "rgba(255,255,255,0.95)" : "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          backdropFilter: isScrolled ? "blur(8px)" : "none",
          transition: "background-color 0.2s",
        }}
      >
        <nav
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
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
              style={{ height: 28, width: 28, objectFit: "contain" }}
            />
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>
              Lluna
            </span>
          </a>

          {/* Desktop nav links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 36,
            }}
            className="desktop-nav"
          >
            {[
              { label: "How It Works", href: "#how-it-works" },
              { label: "Pricing", href: "#pricing" },
              { label: "Partner", href: "#partner" },
              { label: "FAQ", href: "#faq" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  fontSize: 14,
                  color: "#374151",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLElement).style.color = "#0A0A0A")
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLElement).style.color = "#374151")
                }
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="desktop-cta">
            <a
              href="/clinicside/auth"
              style={{
                fontSize: 14,
                color: "#374151",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Enterprise sign in
            </a>
            <a
              href="/demo"
              style={{
                backgroundColor: "#111827",
                color: "#FFFFFF",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                borderRadius: 6,
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.backgroundColor = "#1F2937")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.backgroundColor = "#111827")
              }
            >
              Book a Demo
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              display: "none",
              color: "#0A0A0A",
            }}
            className="mobile-menu-btn"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderTop: "1px solid #E5E7EB",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {[
              { label: "How It Works", href: "#how-it-works" },
              { label: "Pricing", href: "#pricing" },
              { label: "Partner", href: "#partner" },
              { label: "FAQ", href: "#faq" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                style={{
                  fontSize: 16,
                  color: "#111827",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                {link.label}
              </a>
            ))}
            <hr style={{ borderColor: "#E5E7EB", margin: "8px 0" }} />
            <a
              href="/clinicside/auth"
              style={{ fontSize: 15, color: "#374151", textDecoration: "none" }}
            >
              Enterprise sign in
            </a>
            <a
              href="/demo"
              style={{
                backgroundColor: "#111827",
                color: "#FFFFFF",
                padding: "12px 20px",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
                borderRadius: 6,
                textAlign: "center",
              }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Book a Demo
            </a>
          </div>
        )}
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section
        style={{
          paddingTop: 128,
          paddingBottom: 80,
          paddingLeft: 24,
          paddingRight: 24,
          textAlign: "center",
          backgroundColor: "#FFFFFF",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          {/* Eyebrow */}
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#6B7280",
              marginBottom: 24,
            }}
          >
            For Aesthetic Clinics
          </p>

          {/* H1 */}
          <h1
            style={{
              fontSize: "clamp(40px, 6vw, 68px)",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: "#0A0A0A",
              marginBottom: 28,
            }}
          >
            Your consultants&apos; AI sales copilot.
          </h1>

          {/* Subhead */}
          <p
            style={{
              fontSize: "clamp(16px, 2vw, 19px)",
              lineHeight: 1.65,
              color: "#374151",
              maxWidth: 640,
              margin: "0 auto 40px",
            }}
          >
            Lluna briefs your team before every consultation, guides patients to
            the right treatments, and lifts basket value — live in under an hour.
          </p>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 64,
            }}
          >
            <a
              href="/demo"
              style={{
                backgroundColor: "#111827",
                color: "#FFFFFF",
                padding: "14px 28px",
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
                borderRadius: 8,
              }}
            >
              Book a Demo
            </a>
            <a
              href="#how-it-works"
              style={{
                color: "#111827",
                fontSize: 16,
                fontWeight: 500,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              See How It Works →
            </a>
          </div>

          {/* Product screenshot */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)",
              overflow: "hidden",
              maxWidth: 960,
              margin: "0 auto",
            }}
          >
            <img
              src="/product-screenshot.png"
              alt="Lluna product screenshot"
              style={{ width: "100%", display: "block" }}
            />
          </div>
        </div>
      </section>

      {/* ── METRICS BAR ─────────────────────────────────────────────── */}
      <section
        style={{
          backgroundColor: "#F9FAFB",
          padding: "64px 24px",
          borderTop: "1px solid #E5E7EB",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 40,
            textAlign: "center",
          }}
        >
          {[
            { stat: "1.6×", label: "higher basket value per visit" },
            { stat: "80%+", label: "reduction in consult prep time" },
            { stat: "<1hr", label: "to go live" },
            { stat: "60%+", label: "revenue uplift from day one" },
          ].map(({ stat, label }) => (
            <div key={stat}>
              <p
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "#0A0A0A",
                  lineHeight: 1,
                  marginBottom: 12,
                }}
              >
                {stat}
              </p>
              <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.5 }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DIFFERENTIATION ─────────────────────────────────────────── */}
      <section
        style={{
          backgroundColor: "#FFFFFF",
          padding: "96px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "#0A0A0A",
              marginBottom: 24,
              lineHeight: 1.15,
            }}
          >
            Not a CRM. Not a booking tool.
          </h2>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.75,
              color: "#374151",
            }}
          >
            CRMs store data. Booking tools fill calendars. Lluna does one thing:
            it makes every consultation more valuable. Your consultants walk in
            prepared. Your patients leave with the right plan. Your revenue goes
            up.
          </p>
        </div>
      </section>

      {/* ── FEATURE BLOCKS ──────────────────────────────────────────── */}
      <section
        id="how-it-works"
        style={{
          backgroundColor: "#F9FAFB",
          padding: "96px 24px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 40,
          }}
        >
          {[
            {
              label: "FOR YOUR TEAM",
              title: "Every consultant, always prepared.",
              body: "Before each session, Lluna surfaces the patient's full history, past treatments, and highest-probability upsell opportunities. No guessing. No missed revenue because someone had an off day.",
            },
            {
              label: "FOR YOUR CLINIC FLOOR",
              title: "Patients who arrive already interested.",
              body: "Scan a QR code in your waiting area. Lluna's AI — trained on your menu and active campaigns — recommends treatments, answers questions, and surfaces promotions before the consultation even starts.",
            },
            {
              label: "FOR CLINIC OWNERS",
              title: "One dashboard. Full control.",
              body: "Manage your treatment menu, run campaigns, and track performance across every patient touchpoint. White-labeled to your clinic. No technical setup required.",
            },
          ].map(({ label, title, body }) => (
            <div
              key={label}
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: 10,
                padding: "36px 32px",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#6B7280",
                  marginBottom: 16,
                }}
              >
                {label}
              </p>
              <h3
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#0A0A0A",
                  lineHeight: 1.3,
                  marginBottom: 16,
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: "#374151" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY LLUNA ───────────────────────────────────────────────── */}
      <section
        id="partner"
        style={{
          backgroundColor: "#111827",
          padding: "96px 24px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              marginBottom: 48,
              lineHeight: 1.15,
            }}
          >
            Built for clinics that don&apos;t settle.
          </h2>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              maxWidth: 480,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {[
              "Setup in under 1 hour, not weeks",
              "White-labeled to your brand",
              "Works alongside your existing tools",
              "No per-seat pricing. No hidden fees.",
              "Designed for high-end clinics, not mass market",
            ].map((item) => (
              <li
                key={item}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  fontSize: 17,
                  lineHeight: 1.6,
                  color: "#E5E7EB",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    marginTop: 3,
                    backgroundColor: "#374151",
                    borderRadius: "50%",
                    width: 24,
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={14} color="#FFFFFF" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA SECTION ─────────────────────────────────────────────── */}
      <section
        id="pricing"
        style={{
          backgroundColor: "#FFFFFF",
          padding: "96px 24px",
          textAlign: "center",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "#0A0A0A",
              marginBottom: 16,
              lineHeight: 1.15,
            }}
          >
            Ready to increase your basket value?
          </h2>
          <p
            style={{
              fontSize: 18,
              color: "#374151",
              lineHeight: 1.65,
              marginBottom: 40,
            }}
          >
            Join the clinics using Lluna to run smarter consultations.
          </p>
          <a
            href="/demo"
            style={{
              backgroundColor: "#111827",
              color: "#FFFFFF",
              padding: "16px 36px",
              fontSize: 17,
              fontWeight: 700,
              textDecoration: "none",
              borderRadius: 8,
              display: "inline-block",
            }}
          >
            Book a Demo
          </a>
        </div>
      </section>

      {/* ── FAQ PLACEHOLDER ─────────────────────────────────────────── */}
      <section
        id="faq"
        style={{
          backgroundColor: "#F9FAFB",
          padding: "80px 24px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#0A0A0A",
              marginBottom: 48,
              textAlign: "center",
            }}
          >
            Frequently asked questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              {
                q: "How long does setup take?",
                a: "Most clinics are live in under an hour. We handle the onboarding and configure your treatment menu for you.",
              },
              {
                q: "Is Lluna white-labeled?",
                a: "Yes. Patients see your clinic brand throughout. Lluna is invisible unless you choose to mention it.",
              },
              {
                q: "Does it integrate with our existing tools?",
                a: "Lluna works alongside your booking system and CRM — no replacement required. We can discuss specific integrations on a call.",
              },
              {
                q: "What does pricing look like?",
                a: "We don't charge per seat. Talk to us and we'll build a plan around your clinic's size and usage.",
              },
            ].map(({ q, a }, i) => (
              <div
                key={q}
                style={{
                  borderTop: "1px solid #E5E7EB",
                  padding: "28px 0",
                  ...(i === 3 ? { borderBottom: "1px solid #E5E7EB" } : {}),
                }}
              >
                <p
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: "#0A0A0A",
                    marginBottom: 10,
                  }}
                >
                  {q}
                </p>
                <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7 }}>
                  {a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: "1px solid #E5E7EB",
          padding: "40px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 24,
          }}
        >
          {/* Logo */}
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
              style={{ height: 24, width: 24, objectFit: "contain" }}
            />
            <span style={{ fontWeight: 700, fontSize: 16 }}>Lluna</span>
          </a>

          {/* Tagline */}
          <p
            style={{
              fontSize: 13,
              color: "#6B7280",
              textAlign: "center",
              flex: "1 1 auto",
            }}
          >
            The AI layer that makes every consultation count.
          </p>

          {/* Copyright */}
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>
            © {new Date().getFullYear()} Lluna AI
          </p>
        </div>
      </footer>

      {/* ── RESPONSIVE STYLES ───────────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .desktop-cta { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>
    </main>
  );
}
