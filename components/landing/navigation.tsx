"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";

const navLinks = [
  { name: "How It Works", href: "/#how-it-works" },
  { name: "Pricing", href: "/#pricing" },
  { name: "Partner", href: "/#partner" },
  { name: "Blog", href: "/blog" },
  { name: "FAQ", href: "/#faq" },
];

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleEnterprise = () => {
    router.push("/clinicside/auth");
  };

  return (
    <header className="fixed z-50 top-0 left-0 right-0">
      <nav
        style={{
          background: "rgba(245, 242, 235, 0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center justify-between px-8 lg:px-16 xl:px-24 h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5">
            <img src="/lluna-logo.png" alt="Lluna" className="h-7 w-7 object-contain" />
            <span className="font-semibold text-lg tracking-tight">Lluna</span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-300"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="/demo"
              className="bg-foreground text-background px-6 h-10 inline-flex items-center text-[13px] hover:bg-gold transition-colors duration-300"
            >
              Book a Demo
            </a>
            <button
              onClick={handleEnterprise}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-300"
            >
              Enterprise sign in
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`md:hidden fixed inset-0 bg-[#F2EFE9] z-40 transition-opacity duration-300 ${
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col h-full px-8 pt-28 pb-8">
          <div className="flex-1 flex flex-col justify-center gap-8">
            {navLinks.map((link, i) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-3xl font-light text-foreground hover:text-muted-foreground transition-opacity duration-500 ${
                  isMobileMenuOpen ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms" }}
              >
                {link.name}
              </a>
            ))}
          </div>

          <div
            className={`pt-8 border-t border-warm-border transition-opacity duration-500 ${
              isMobileMenuOpen ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: isMobileMenuOpen ? "300ms" : "0ms" }}
          >
            <a
              href="/demo"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block w-full bg-foreground text-background h-12 text-[15px] flex items-center justify-center mb-3"
            >
              Book a Demo
            </a>
            <button
              onClick={() => { setIsMobileMenuOpen(false); handleEnterprise(); }}
              className="w-full text-[14px] text-muted-foreground text-center"
            >
              Enterprise sign in
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
