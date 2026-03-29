"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, MessageCircle, Send, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminSupportPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversations = useQuery(api.supportChat.adminListConversations);
  const unreadCount = useQuery(api.supportChat.adminUnreadCount) ?? 0;
  const messages = useQuery(
    api.supportChat.adminListForUser,
    selectedUserId ? { userId: selectedUserId } : "skip"
  );
  const replyMutation = useMutation(api.supportChat.adminReply);
  const deleteMessageMutation = useMutation(api.supportChat.adminDeleteMessage);
  const deleteConversationMutation = useMutation(api.supportChat.adminDeleteConversation);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendReply() {
    if (!selectedUserId || !replyInput.trim() || isSending) return;
    setIsSending(true);
    try {
      await replyMutation({ userId: selectedUserId, content: replyInput.trim() });
      setReplyInput("");
      toast.success("Reply sent");
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setIsSending(false);
    }
  }

  async function handleDeleteConversation(userId: string) {
    if (deletingConversationId) return;
    setDeletingConversationId(userId);
    try {
      await deleteConversationMutation({ userId });
      if (selectedUserId === userId) setSelectedUserId(null);
      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete conversation");
    } finally {
      setDeletingConversationId(null);
    }
  }

  async function handleDeleteMessage(messageId: Id<"support_messages">) {
    if (deletingMessageId) return;
    setDeletingMessageId(messageId);
    try {
      await deleteMessageMutation({ messageId });
      toast.success("Message deleted");
    } catch {
      toast.error("Failed to delete message");
    } finally {
      setDeletingMessageId(null);
    }
  }

  const selectedConv = selectedUserId
    ? conversations?.find((c) => c.userId === selectedUserId)
    : null;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            "flex shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
            "w-full lg:w-[28rem] xl:w-[32rem]",
            selectedUserId ? "hidden lg:flex" : "flex"
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Conversations</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {conversations?.length ?? 0} {(conversations?.length ?? 0) === 1 ? "thread" : "threads"}
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-0.5 p-2">
              {conversations === undefined ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="py-10 text-center">
                  <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">User messages will appear here</p>
                </div>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.userId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedUserId(c.userId)}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedUserId(c.userId)}
                    className={cn(
                      "group relative w-full cursor-pointer rounded-lg px-3 py-3 text-left transition-colors",
                      selectedUserId === c.userId
                        ? "bg-primary/10 text-primary dark:bg-primary/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                      c.unreadBySupport && "border-l-2 border-l-primary"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
                          {c.userName || c.userEmail || "Unknown user"}
                        </p>
                        <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                          {c.lastMessagePreview}
                        </p>
                      </div>
                      <span className="shrink-0 pt-0.5 text-[10px] text-muted-foreground">
                        {new Date(c.lastMessageAt).toLocaleDateString("en-ZA", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    {c.unreadBySupport && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Awaiting reply
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(c.userId);
                      }}
                      disabled={!!deletingConversationId}
                      aria-label="Delete conversation"
                      className={cn(
                        "absolute bottom-2 right-2",
                        "flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100",
                        "border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800",
                        "text-slate-400 hover:border-destructive/40 hover:text-destructive dark:hover:text-destructive",
                        "disabled:cursor-not-allowed disabled:opacity-30"
                      )}
                    >
                      {deletingConversationId === c.userId ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-2.5 w-2.5" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950",
            selectedUserId ? "flex" : "hidden lg:flex"
          )}
        >
          {selectedUserId ? (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-1 h-10 w-10 shrink-0 text-muted-foreground lg:hidden"
                  onClick={() => setSelectedUserId(null)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedConv?.userName || selectedConv?.userEmail || "User"}
                  </p>
                  {selectedConv?.userEmail && selectedConv?.userName && (
                    <p className="truncate text-xs text-muted-foreground">{selectedConv.userEmail}</p>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-4 px-5 py-4">
                  {messages === undefined ? (
                    <div className="space-y-3 animate-pulse">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                          <div
                            className={cn(
                              "h-10 rounded-2xl bg-slate-200 dark:bg-slate-700",
                              i % 2 === 0 ? "w-2/3" : "w-1/2"
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m._id}
                        className={cn("group flex", m.role === "user" ? "justify-start" : "justify-end")}
                      >
                        <div className="relative max-w-[75%]">
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                              m.role === "user"
                                ? "border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                : "bg-primary text-white"
                            )}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                            <p
                              className={cn(
                                "mt-1 text-[10px]",
                                m.role === "user"
                                  ? "text-muted-foreground"
                                  : "text-white/80"
                              )}
                            >
                              {new Date(m.createdAt).toLocaleString("en-ZA", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {m.role === "support" && !m.isAutoReply && " • You"}
                              {m.role === "support" && m.isAutoReply && " • auto-reply"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(m._id)}
                            disabled={!!deletingMessageId}
                            aria-label="Delete message"
                            className={cn(
                              "absolute -bottom-2.5",
                              m.role === "user" ? "right-1" : "left-1",
                              "flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100",
                              "border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800",
                              "text-slate-400 hover:border-destructive/40 hover:text-destructive dark:hover:text-destructive",
                              "disabled:cursor-not-allowed disabled:opacity-30"
                            )}
                          >
                            {deletingMessageId === m._id ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-2.5 w-2.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type your reply..."
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendReply()}
                    disabled={isSending}
                    className="flex-1 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendReply}
                    disabled={!replyInput.trim() || isSending}
                    className="shrink-0 bg-primary text-white hover:bg-primary/90 hover:text-white disabled:text-white/70 [&_svg]:text-white"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Send className="h-4 w-4 text-white" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <MessageCircle className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-base font-medium text-slate-900 dark:text-white">Select a conversation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a conversation from the list to view messages and reply.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
