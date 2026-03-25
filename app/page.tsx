"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { WhyChooseUs } from "@/components/landing/WhyChooseUs";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ProcessSection } from "@/components/landing/ProcessSection";
import { Pricing } from "@/components/landing/Pricing";
import { Testimonials } from "@/components/landing/Testimonials";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

const SECTIONS = [
  "hero",
  "why-choose-us",
  "workflow",
  "how-it-works",
  "pricing",
  "testimonials",
  "cta",
];

export default function Homepage() {
  const [activeSection, setActiveSection] = useState("hero");

  const handleScroll = useCallback(() => {
    const scrollPosition = window.scrollY + 100;
    for (const section of SECTIONS) {
      const element = document.getElementById(section);
      if (element) {
        const offsetTop = element.offsetTop;
        const offsetBottom = offsetTop + element.offsetHeight;
        if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
          setActiveSection(section);
          break;
        }
      }
    }
  }, []);

  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout>;
    const debounced = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 50);
    };
    window.addEventListener("scroll", debounced);
    handleScroll();
    return () => {
      window.removeEventListener("scroll", debounced);
      clearTimeout(scrollTimeout);
    };
  }, [handleScroll]);

  return (
    <div className="min-h-screen bg-north-gray/20 dark:bg-slate-900 antialiased scrollbar-hide">
      {/* Header + Hero — North Star Seal (navy) */}
      <div className="bg-north-navy">
        <Header activeSection={activeSection} onSectionChange={setActiveSection} />
        <Hero />
      </div>

      <main className="relative">
        <WhyChooseUs />
        <FeaturesSection />
        <ProcessSection />
        <Pricing />
        <Testimonials />
        <CTA />
      </main>

      <Footer />
    </div>
  );
}
