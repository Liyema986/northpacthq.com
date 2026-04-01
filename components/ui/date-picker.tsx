"use client"

import * as React from "react"
import { format, parse, startOfMonth, setMonth, setYear } from "date-fns"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/* ── Single-date picker ──────────────────────────────────────────────────── */

interface DatePickerProps {
  /** ISO date string (YYYY-MM-DD) or empty */
  value?: string
  onChange: (iso: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({
  value, onChange, placeholder = "Pick a date", className, disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center rounded-lg border border-slate-200 bg-white px-3 text-left text-[13px] transition-colors hover:border-slate-300 focus:outline-none focus:border-[#C8A96E]",
            !value && "text-slate-400",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
          <span className="flex-1 truncate">
            {selected && !isNaN(selected.getTime()) ? format(selected, "d MMM yyyy") : placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (day) onChange(format(day, "yyyy-MM-dd"))
            setOpen(false)
          }}
          defaultMonth={selected ?? new Date()}
        />
      </PopoverContent>
    </Popover>
  )
}

/* ── Month picker (YYYY-MM) ──────────────────────────────────────────────── */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

interface MonthPickerProps {
  /** ISO month string (YYYY-MM) or empty */
  value?: string
  onChange: (iso: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function MonthPicker({
  value, onChange, placeholder = "Pick a month", className, disabled,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false)
  const parsed = value ? parse(value, "yyyy-MM", new Date()) : null
  const selected = parsed && !isNaN(parsed.getTime()) ? parsed : null
  const [viewYear, setViewYear] = React.useState(() =>
    selected ? selected.getFullYear() : new Date().getFullYear()
  )

  // Sync viewYear when value changes
  React.useEffect(() => {
    if (selected) setViewYear(selected.getFullYear())
  }, [selected])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center rounded-lg border border-slate-200 bg-white px-3 text-left text-[13px] transition-colors hover:border-slate-300 focus:outline-none focus:border-[#C8A96E]",
            !value && "text-slate-400",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
          <span className="flex-1 truncate">
            {selected ? format(selected, "MMMM yyyy") : placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">{viewYear}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((m, idx) => {
            const isSelected = selected && selected.getFullYear() === viewYear && selected.getMonth() === idx
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  const d = startOfMonth(setMonth(setYear(new Date(), viewYear), idx))
                  onChange(format(d, "yyyy-MM"))
                  setOpen(false)
                }}
                className={cn(
                  "h-9 rounded-md text-[13px] font-medium transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                )}
              >
                {m}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
