import { Heart, Star, FileText } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface Template {
  id: string;
  title: string;
  category: string;
  image: string;
  downloads: string;
  rating: number;
  isPro: boolean;
  price: string;
}

interface TemplateCardProps {
  template: Template;
  variant?: "default" | "on-primary";
}

export function TemplateCard({ template, variant = "default" }: TemplateCardProps) {
  const textColor = variant === "on-primary" ? "text-white" : "text-slate-900 dark:text-white";
  const mutedColor = variant === "on-primary" ? "text-white/70" : "text-slate-500 dark:text-slate-400";

  return (
    <Link href="#pricing" className="group block h-full">
      <div className="flex flex-col h-full gap-3">
        <div className="aspect-square relative overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800 group-hover:shadow-lg transition-all duration-300 border border-transparent group-hover:border-primary/20">
          {template.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={template.image}
              alt={template.title}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 ease-in-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600">
              <FileText className="w-12 h-12" />
            </div>
          )}

          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
            <span className={cn("text-xs font-semibold", template.isPro ? "text-primary" : "text-emerald-600")}>
              {template.isPro ? "Pro Template" : "Free"}
            </span>
          </div>

          <button className="absolute top-3 right-3 p-2 rounded-full hover:bg-white/10 transition-colors z-10 group/heart cursor-pointer">
            <Heart className="h-6 w-6 text-white drop-shadow-md stroke-[2px] group-hover/heart:scale-110 transition-transform" />
          </button>
        </div>

        <div className="flex flex-col gap-1 px-1">
          <div className="flex justify-between items-start gap-2">
            <h3 className={cn("font-semibold text-base leading-tight truncate", textColor)}>{template.title}</h3>
            <div className="flex items-center gap-1 text-sm shrink-0">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className={variant === "on-primary" ? "text-white/90" : "text-slate-600 dark:text-slate-400"}>
                {template.rating}
              </span>
            </div>
          </div>
          <p className={cn("text-sm leading-tight", mutedColor)}>{template.category}</p>
          <p className={cn("text-sm leading-tight", mutedColor)}>{template.downloads} downloads</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={cn("font-semibold text-base", textColor)}>{template.price}</span>
            <span className={cn("font-normal text-sm", mutedColor)}>per license</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
