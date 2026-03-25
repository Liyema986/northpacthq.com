"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

type LineRow = {
  _id: Id<"services">;
  name: string;
  serviceSchedule?: string;
};

type SectionRow = {
  _id: Id<"serviceSections">;
  name: string;
  engagementParagraphHtml?: string;
  lineItems: LineRow[];
};

const ACCENT = "#C8A96E";

export function ServiceCatalogueClauses({ userId }: { userId: Id<"users"> }) {
  const sections = useQuery(api.lineItems.listSectionsWithItems, { userId });

  const loading = sections === undefined;

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <p className="text-[12px] text-slate-500 px-4 pb-4">
        Add sections under <span className="font-medium text-slate-700">Services</span> first. Each
        section can carry an introduction paragraph; each line item can carry a clause that merges
        into generated engagement letters when that service is on an accepted proposal.
      </p>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Mirrors your <span className="font-medium text-slate-700">Services</span> catalogue. Section
        text appears once when the engagement letter includes any service from that section. Line-item
        text (schedule) is appended per service in proposal order.
      </p>
      {sections.map((sec) => (
        <SectionBlock key={sec._id} userId={userId} section={sec as SectionRow} />
      ))}
    </div>
  );
}

function SectionBlock({ userId, section }: { userId: Id<"users">; section: SectionRow }) {
  const [open, setOpen] = useState(true);
  const [sectionHtml, setSectionHtml] = useState(section.engagementParagraphHtml ?? "");
  const [schedules, setSchedules] = useState<Record<string, string>>(() =>
    Object.fromEntries(section.lineItems.map((l) => [l._id, l.serviceSchedule ?? ""]))
  );
  const [saving, setSaving] = useState(false);

  const updateSection = useMutation(api.lineItems.updateSection);
  const updateLineItem = useMutation(api.lineItems.updateLineItem);

  const lineSyncKey = JSON.stringify(
    section.lineItems.map((l) => ({ id: l._id, schedule: l.serviceSchedule ?? "" }))
  );

  useEffect(() => {
    setSectionHtml(section.engagementParagraphHtml ?? "");
    setSchedules(Object.fromEntries(section.lineItems.map((l) => [l._id, l.serviceSchedule ?? ""])));
  }, [section._id, section.engagementParagraphHtml, lineSyncKey]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSection({
        userId,
        sectionId: section._id,
        engagementParagraphHtml: sectionHtml.trim() || undefined,
      });
      for (const line of section.lineItems) {
        const next = schedules[line._id] ?? "";
        const prev = line.serviceSchedule ?? "";
        if (next.trim() === prev.trim()) continue;
        await updateLineItem({
          userId,
          lineItemId: line._id,
          serviceSchedule: next.trim() || undefined,
        });
      }
      toast.success("Engagement clauses saved");
    } catch {
      toast.error("Could not save clauses");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-slate-800 hover:bg-slate-100/80">
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          <span className="truncate">{section.name}</span>
          <span className="text-[11px] font-normal text-slate-400">
            ({section.lineItems.length} line {section.lineItems.length === 1 ? "item" : "items"})
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-slate-200 bg-white px-3 py-3 space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">Section introduction (HTML)</label>
              <p className="text-[10px] text-slate-400">
                Shown once in the letter when any service from this section is included.
              </p>
              <textarea
                value={sectionHtml}
                onChange={(e) => setSectionHtml(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/30 font-mono"
                placeholder="<p>…</p>"
              />
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-medium text-slate-600">Per line item — schedule / clause (HTML)</p>
              {section.lineItems.length === 0 ? (
                <p className="text-[12px] text-slate-400">No line items in this section.</p>
              ) : (
                section.lineItems.map((line) => (
                  <div key={line._id} className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-700">{line.name}</label>
                    <textarea
                      value={schedules[line._id] ?? ""}
                      onChange={(e) =>
                        setSchedules((prev) => ({ ...prev, [line._id]: e.target.value }))
                      }
                      rows={3}
                      className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/30 font-mono"
                      placeholder="Clause for this service when it appears on a proposal…"
                    />
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                size="sm"
                disabled={saving}
                className="text-white"
                style={{ background: ACCENT }}
                onClick={handleSave}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Saving…
                  </>
                ) : (
                  "Save section"
                )}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
