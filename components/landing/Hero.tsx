"use client";

import { Button } from "@/components/ui/button";
import { Play, Star } from "lucide-react";
import { motion } from "framer-motion";
import Marquee from "react-fast-marquee";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { useRouter } from "next/navigation";

const HERO_TESTIMONIALS = [
  { name: "Sarah Chen", avatar: "https://i.pravatar.cc/100?u=sarah", quote: "Cut our proposal time from days to minutes." },
  { name: "Marcus Webb", avatar: "https://i.pravatar.cc/100?u=marcus", quote: "A game-changer for our consulting firm." },
  { name: "Elena Rodriguez", avatar: "https://i.pravatar.cc/100?u=elena", quote: "Clients love the professional look and feel." },
  { name: "James Okafor", avatar: "https://i.pravatar.cc/100?u=james", quote: "Win rate improved by 30% in 3 months." },
  { name: "Priya Sharma", avatar: "https://i.pravatar.cc/100?u=priya", quote: "Finally, one place for all our proposals." },
  { name: "David Kim", avatar: "https://i.pravatar.cc/100?u=david", quote: "The best investment we made this year." },
  { name: "Lisa van Wyk", avatar: "https://i.pravatar.cc/100?u=lisa", quote: "So intuitive, the whole team adopted it instantly." },
  { name: "Tom Ndlovu", avatar: "https://i.pravatar.cc/100?u=tom", quote: "Closed our biggest deal using NorthPact." },
];

/** North Star Seal: navy #243E63, gold #C8A96E, gray #D9D4CE */
const CIRCLES: { size: number; top: string; left?: string; right?: string; bg: string }[] = [
  { size: 80, top: "22%",  left: "4%",  bg: "bg-north-gray/35" },
  { size: 60, top: "45%",  left: "2%",  bg: "bg-north-gold/25" },
  { size: 52, top: "62%",  left: "5%",  bg: "bg-white/15" },
  { size: 68, top: "22%",  right: "4%", bg: "bg-north-gold/20" },
  { size: 80, top: "45%",  right: "2%", bg: "bg-north-gray/30" },
  { size: 60, top: "62%",  right: "5%", bg: "bg-white/10" },
];

export function Hero() {
  const router = useRouter();
  const { isAuthenticated } = useNorthPactAuth();

  const handleGetStarted = () => {
    router.push(isAuthenticated ? "/dashboard" : "/auth");
  };

  return (
    <section
      id="hero"
      className="relative w-full min-h-[calc(100vh-5rem)] md:min-h-[calc(100vh-5.5rem)] overflow-hidden flex flex-col bg-north-navy"
    >
      {/* Decorative floating circles — positioned on left/right margins like the Figma design */}
      {CIRCLES.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 + i * 0.15, duration: 0.6 }}
          className={`absolute rounded-full pointer-events-none hidden md:block ${c.bg}`}
          style={{
            width: c.size,
            height: c.size,
            top: c.top,
            ...(c.left ? { left: c.left } : {}),
            ...(c.right ? { right: c.right } : {}),
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full mx-auto px-6 md:px-14">
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-center text-white font-semibold w-full text-[2rem] sm:text-[2.8rem] md:text-[3.5rem] lg:text-[4.5rem] xl:text-[6rem] leading-[1.08]"
        >
          Win More Clients.
          <br />
          One Proposal at a Time.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center text-north-gray font-normal max-w-[900px] w-full mt-4 md:mt-5 text-[15px] sm:text-[16px] md:text-[17px] lg:text-[18px] leading-[1.6]"
        >
          Create professional, branded proposals in minutes. Manage clients, pricing, and templates in one place — and close deals faster.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex flex-col sm:flex-row items-center gap-3 mt-6 md:mt-7 w-full sm:w-auto"
        >
          <Button
            onClick={handleGetStarted}
            className="w-full sm:w-auto rounded-full bg-north-gold text-white hover:bg-north-gold/90 font-semibold text-[16px] h-[52px] px-9 shadow-none transition-transform hover:scale-[1.02]"
          >
            Get Started Free
          </Button>

          <Button
            variant="ghost"
            className="w-full sm:w-auto rounded-full border border-north-gold/80 bg-transparent text-white hover:bg-north-gold/15 hover:text-white font-semibold text-[16px] h-[52px] px-9"
            onClick={() => {
              const el = document.getElementById("workflow");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Play className="h-3.5 w-3.5 fill-current mr-2" />
            Watch Demo
          </Button>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 mt-5 md:mt-6"
        >
          <div className="flex -space-x-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-north-gold bg-white/10 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.pravatar.cc/100?u=${i + 10}`} alt="User" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex text-north-gold">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-north-gold text-north-gold" />
              ))}
            </div>
            <p className="text-north-gray font-medium text-[13px] sm:text-[14px]">Trusted by 2,000+ professionals</p>
          </div>
        </motion.div>
      </div>

      {/* Testimonial marquee at bottom */}
      <div className="relative z-10 w-full overflow-hidden py-4 md:py-6 border-t border-north-gold/25">
        <Marquee gradient={false} speed={35} pauseOnHover>
          <div className="flex items-center shrink-0 gap-4 md:gap-8 pr-4 md:pr-8">
            {HERO_TESTIMONIALS.map((t, i) => (
              <div key={i} className="flex items-center gap-2.5 md:gap-3 bg-north-gray/10 backdrop-blur-sm rounded-full py-2 md:py-2.5 px-3.5 md:px-5 shrink-0 border border-north-gold/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-7 h-7 md:w-9 md:h-9 rounded-full object-cover border-2 border-north-gold/40 shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <p className="text-north-gray italic text-[12px] md:text-[13px] leading-tight truncate max-w-[160px] md:max-w-[220px]">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <span className="text-white/70 text-[10px] md:text-[11px] font-medium mt-0.5">{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </Marquee>
      </div>
    </section>
  );
}
