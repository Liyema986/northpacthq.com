"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { PartyPopper } from "lucide-react";

export function WelcomeConfetti() {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    try {
      if (!sessionStorage.getItem("northpact_new_user_welcome")) return;
      sessionStorage.removeItem("northpact_new_user_welcome");
    } catch {
      return;
    }
    firedRef.current = true;

    toast.success("Welcome to NorthPact!", {
      description: "Your workspace is ready. Start by adding a client or creating your first proposal.",
      duration: 7000,
      icon: <PartyPopper className="h-5 w-5 text-[#C8A96E]" />,
    });

    import("canvas-confetti").then(({ default: confetti }) => {
      const colors = ["#C8A96E", "#243E63", "#F4B400", "#4285F4", "#ffffff"];
      const opts = { colors, zIndex: 999999, startVelocity: 55, ticks: 130 };

      // Opening salvo from three points
      confetti({ ...opts, particleCount: 200, spread: 180, origin: { x: 0.5, y: 0.4 } });
      confetti({ ...opts, particleCount: 120, spread: 120, angle: 60,  origin: { x: 0, y: 0.5 } });
      confetti({ ...opts, particleCount: 120, spread: 120, angle: 120, origin: { x: 1, y: 0.5 } });

      // Sustained side cannons for 4 seconds
      const end = Date.now() + 4000;
      const interval = setInterval(() => {
        if (Date.now() > end) { clearInterval(interval); return; }
        confetti({ ...opts, particleCount: 18, angle: 60,  spread: 80, origin: { x: 0, y: 0.65 } });
        confetti({ ...opts, particleCount: 18, angle: 120, spread: 80, origin: { x: 1, y: 0.65 } });
      }, 120);
    });
  }, []);

  return null;
}
