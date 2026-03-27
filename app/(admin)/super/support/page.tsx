"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageCircle, Send, Trash2, Loader2, ChevronLeft, User,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString("en-ZA", { month: "short", day: "numeric" });
}

export default function AdminSupportPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const conversations = useQuery(api.supportChat.adminListConversations);
  const messages = useQuery(
    api.supportChat.adminListForUser,
    selectedUserId ? { userId: selectedUserId } : "skip"
  );
  const adminReply = useMutation(api.supportChat.adminReply);
  const deleteConversation = useMutation(api.supportChat.adminDeleteConversation);

  const selectedConvo = conversations?.find((c) => c.userId === selectedUserId);

  async function handleReply() {
    if (!selectedUserId || !replyInput.trim() || isSending) return;
    setIsSending(true);
    try {
      await adminReply({ userId: selectedUserId, content: replyInput.trim() });
      setReplyInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setIsSending(false);
    }
  }

  async function handleDelete(userId: string) {
    try {
      await deleteConversation({ userId });
      if (selectedUserId === userId) setSelectedUserId(null);
      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete conversation");
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversation list */}
      <div className={cn(
        "w-full lg:w-[300px] border-r shrink-0 flex flex-col",
        selectedUserId ? "hidden lg:flex" : "flex"
      )}>
        <div className="px-4 py-3 border-b shrink-0">
          <h1 className="text-base font-semibold text-slate-800">Support Inbox</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {conversations?.filter((c) => c.unreadBySupport).length ?? 0} awaiting reply
          </p>
        </div>

        <ScrollArea className="flex-1">
          {conversations === undefined ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <MessageCircle className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-600">No conversations yet</p>
              <p className="text-xs text-slate-400 mt-1">Support messages will appear here.</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => setSelectedUserId(c.userId)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                    selectedUserId === c.userId
                      ? "bg-[#C8A96E]/10 border border-[#C8A96E]/30"
                      : "hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[#C8A96E]/20 flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-[#C8A96E]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-slate-800 truncate">
                          {c.userName ?? c.userEmail ?? "Unknown user"}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{c.lastMessagePreview}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-slate-400">{timeAgo(c.lastMessageAt)}</span>
                      {c.unreadBySupport && (
                        <span className="h-2 w-2 rounded-full bg-[#C8A96E]" aria-label="Unread" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Thread view */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        selectedUserId ? "flex" : "hidden lg:flex"
      )}>
        {!selectedUserId ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <MessageCircle className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="lg:hidden p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedConvo?.userName ?? selectedConvo?.userEmail ?? "Unknown user"}
                  </p>
                  {selectedConvo?.userEmail && selectedConvo.userName && (
                    <p className="text-xs text-slate-400">{selectedConvo.userEmail}</p>
                  )}
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All messages in this conversation will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(selectedUserId)}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="py-4 space-y-4">
                {messages === undefined ? (
                  <div className="space-y-3 animate-pulse">
                    {[1,2,3].map(i => (
                      <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                        <div className={`h-9 rounded-lg bg-muted ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
                      </div>
                    ))}
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m._id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] rounded-lg px-3 py-2 text-sm space-y-1",
                        m.role === "user" ? "bg-[#243E63] text-white" : "bg-muted"
                      )}>
                        <p>{m.content}</p>
                        <p className={cn("text-[10px]", m.role === "user" ? "text-white/60" : "text-muted-foreground")}>
                          {timeAgo(m.createdAt)}
                          {m.isAutoReply && " · auto-reply"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Reply input */}
            <div className="p-4 border-t shrink-0">
              <div className="flex gap-2">
                <Input
                  placeholder="Reply as support..."
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleReply()}
                  disabled={isSending}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleReply}
                  disabled={!replyInput.trim() || isSending}
                  className="bg-[#243E63] hover:bg-[#1a2f4b]"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
