"use client";

import { TemplateCard, type Template } from "./TemplateCard";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";

const MOCK_TEMPLATES: Template[] = [
  { id: "1", title: "Digital Marketing Proposal", category: "Marketing", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=500&auto=format&fit=crop", downloads: "2.5k", rating: 4.9, isPro: true, price: "Free" },
  { id: "2", title: "Web Design Contract", category: "Design", image: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?q=80&w=500&auto=format&fit=crop", downloads: "1.8k", rating: 4.8, isPro: false, price: "Free" },
  { id: "3", title: "SEO Retainer Agreement", category: "Marketing", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=500&auto=format&fit=crop", downloads: "3.2k", rating: 5.0, isPro: true, price: "Pro" },
  { id: "4", title: "Software Development SOW", category: "Development", image: "https://images.unsplash.com/photo-1555099962-4199c345e5dd?q=80&w=500&auto=format&fit=crop", downloads: "900", rating: 4.7, isPro: true, price: "Pro" },
  { id: "5", title: "Social Media Strategy", category: "Marketing", image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=500&auto=format&fit=crop", downloads: "4.1k", rating: 4.9, isPro: false, price: "Free" },
];

export function FeaturedTemplates() {
  const [activeFilter, setActiveFilter] = useState("All");

  const filters = ["All", "Marketing", "Design", "Development", "Business"];

  const filteredTemplates =
    activeFilter === "All" ? MOCK_TEMPLATES : MOCK_TEMPLATES.filter((t) => t.category === activeFilter);

  return (
    <section id="templates" className="w-full py-12 md:py-16 bg-primary overflow-hidden relative">
      <div className="absolute top-0 right-0 w-[50%] h-full bg-white/5 skew-x-12 transform origin-top-right pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[30%] h-[50%] bg-black/5 rounded-tr-[100px] pointer-events-none" />

      <div className="w-full px-4 md:px-8 mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-lg text-left"
          >
            <span className="text-white/80 font-bold tracking-wider uppercase text-xs mb-1.5 block">Start Faster</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-white">
              Featured <br />
              <span className="text-white relative">
                Templates
                <svg className="absolute w-full h-2 -bottom-1 left-0 text-white opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              </span>
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap justify-start md:justify-end gap-2"
          >
            {filters.map((filter, index) => (
              <motion.button
                key={filter}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "px-5 py-2 rounded-full text-xs font-semibold transition-all duration-300 border relative overflow-hidden",
                  activeFilter === filter
                    ? "bg-white text-primary border-white shadow-md"
                    : "bg-primary/50 text-white/80 border-white/20 hover:border-white/50 hover:text-white hover:bg-white/10"
                )}
              >
                {activeFilter === filter && (
                  <div className="absolute top-0 right-0 w-[50%] h-full bg-primary/5 skew-x-12 transform origin-top-right pointer-events-none" />
                )}
                <span className="relative z-10">{filter}</span>
              </motion.button>
            ))}
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {filteredTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <TemplateCard template={template} variant="on-primary" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
