import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { Send, Bot, Sparkles, ChevronDown } from "lucide-react";
import { Link } from "react-router";
import type { Route } from "./+types/chat";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  ChatBubble,
  ChatBubbleMessage,
} from "~/components/chat/chat-bubble";

// ── Types ──────────────────────────────────────────────────────

type Message = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
};

// ── Helpers ────────────────────────────────────────────────────

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}



// ── Meta ───────────────────────────────────────────────────────

export function meta({}: Route.MetaArgs) {
  return [{ title: "AI Chat - Chatbot" }];
}

// ── Component ──────────────────────────────────────────────────

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: createId(),
      role: "assistant",
      content:
        "Xin chào! 👋 Mình là AI Assistant. Hãy đặt câu hỏi hoặc chia sẻ ý tưởng với mình nhé!",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = Math.max(80, Math.floor(window.innerHeight * 0.18));
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottomButton(distanceFromBottom > threshold);
  };

  const scrollToBottom = () => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    setShowScrollBottomButton(false);
  };

  // Focus textarea khi mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = Math.max(80, Math.floor(window.innerHeight * 0.18));
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottomButton(distanceFromBottom > threshold);
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a helpful AI assistant." },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: trimmed },
          ],
          temperature: 0.5,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";
      const pendingRef = { current: "" };
      let flushTimer: number | null = null;
      let aiMessage: Message | null = null;

      const flushPending = () => {
        if (pendingRef.current) {
          aiContent += pendingRef.current;
          pendingRef.current = "";
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessage?.id ? { ...msg, content: aiContent } : msg,
            ),
          );
        }
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
      };

      const scheduleFlush = () => {
        if (!flushTimer) {
          flushTimer = window.setTimeout(() => {
            flushTimer = null;
            flushPending();
          }, 60);
        }
      };

      const extractToken = (data: string): string | null => {
        if (!data || data === "[DONE]" || data === "{}") return null;

        try {
          const parsed = JSON.parse(data);
          if (typeof parsed === "object" && parsed !== null) {
            return (
              parsed.choices?.[0]?.delta?.content ??
              parsed.token ??
              parsed.content ??
              parsed.text ??
              parsed.message?.content ??
              null
            );
          }
        } catch {
          // Không phải JSON, trả về raw data luôn
          return data;
        }

        return null;
      };

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            flushPending();
            break;
          }

          const text = decoder.decode(value, { stream: true });

          // Backend SSE thực tế đang gửi:
          // - data: {"token": chunk}\n\n
          // - event: done\ndata: {}\n\n
          // Tách event theo newline
          const parts = text.split("\n");

          for (const part of parts) {
            const trimmed = part.trim();

            if (!trimmed) continue;

            if (trimmed.startsWith("data:")) {
              const data = trimmed.slice(5).trim();
              const token = extractToken(data);
              if (typeof token === "string" && token) {
                pendingRef.current += token;

                if (!aiMessage) {
                  const newAiMessage: Message = {
                    id: createId(),
                    role: "assistant",
                    content: "",
                    timestamp: Date.now(),
                  };
                  aiMessage = newAiMessage;
                  setMessages((prev) => [...prev, newAiMessage]);
                  scrollToBottom();
                }

                scheduleFlush();
              }
              continue;
            }

            if (trimmed.startsWith("event:")) {
              const eventType = trimmed.slice(6).trim();
              if (eventType === "done") {
                flushPending();
              }
              continue;
            }

            if (trimmed.startsWith("message\t")) {
              const chunk = trimmed.slice("message\t".length).trim();
              if (chunk) {
                pendingRef.current += chunk;

                if (!aiMessage) {
                  const newAiMessage: Message = {
                    id: createId(),
                    role: "assistant",
                    content: "",
                    timestamp: Date.now(),
                  };
                  aiMessage = newAiMessage;
                  setMessages((prev) => [...prev, newAiMessage]);
                  scrollToBottom();
                }

                scheduleFlush();
              }
              continue;
            }

            if (trimmed.startsWith("done")) {
              flushPending();
              continue;
            }
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Đã có lỗi xảy ra";
      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === "assistant" && !msg.content
            ? { ...msg, content: `[Lỗi] ${errorMessage}` }
            : msg,
        ),
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-lg shadow-primary/20">
              <Bot className="size-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-foreground">
                AI Assistant
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Trợ lý thông minh của bạn
              </p>
            </div>
          </div>

          <Link to="/">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-2xl text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="size-4" />
              <span className="ml-1.5 text-xs font-semibold">Trang chủ</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-3xl px-4 py-6">
          {/* Welcome section when empty */}
          {messages.length === 1 && (
            <div className="mb-8 flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <Sparkles className="size-7" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground">
                  Bắt đầu trò chuyện
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hãy hỏi mình bất cứ điều gì — mình sẵn sàng giúp bạn!
                </p>
              </div>
            </div>
          )}

          {/* Message list */}
          <div className="flex flex-col gap-4">
            {messages
              .filter((message) => {
                if (message.role === "system") return false;
                if (message.role === "assistant" && !message.content && isTyping) {
                  return false;
                }
                return true;
              })
              .map((message) => (
                <ChatBubble
                  key={message.id}
                  variant={message.role === "user" ? "user" : "assistant"}
                  showAvatar
                >
                  <ChatBubbleMessage variant={message.role === "user" ? "user" : "assistant"}>
                    {message.content}
                  </ChatBubbleMessage>
                </ChatBubble>
              ))}

            {/* Typing indicator */}
            {isTyping && (
              <ChatBubble variant="assistant" showAvatar>
                <div className="flex items-center gap-1 rounded-3xl bg-muted px-4 py-3 border border-border/60">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                </div>
              </ChatBubble>
            )}

            <div ref={messagesEndRef} className="h-0" />
          </div>
        </div>
      </div>

      {showScrollBottomButton && (
        <div className="pointer-events-none sticky inset-x-0 bottom-24 z-50 flex justify-center">
          <button
            type="button"
            onClick={scrollToBottom}
            className="pointer-events-auto flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-xl backdrop-blur transition hover:bg-muted active:scale-95"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="sticky bottom-0 border-t border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập tin nhắn... (Enter để gửi)"
                className="min-h-[44px] max-h-32 resize-none rounded-2xl bg-input/50 py-2.5 pr-3 pl-4 text-sm"
                rows={1}
                disabled={isTyping}
              />
            </div>

            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isTyping}
              className="size-11 shrink-0 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 active:scale-95 disabled:opacity-40"
            >
              <Send className="size-4" />
            </Button>
          </form>

          <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
            AI có thể đưa ra thông tin không chính xác. Hãy kiểm tra các thông tin quan trọng.
          </p>
        </div>
      </div>
    </div>
  );
}


export function useWindowScrollToBottom(threshold = 150) {
  const [showFloatButton, setShowFloatButton] = useState(false);

  useEffect(() => {
    const updateDistance = () => {
      const { scrollY, innerHeight } = window;
      const { scrollHeight } = document.documentElement;

      const distance = Math.max(
        0,
        scrollHeight - scrollY - innerHeight
      );

      setShowFloatButton(distance > threshold);
    };

    updateDistance();

    window.addEventListener("scroll", updateDistance, {
      passive: true,
    });

    window.addEventListener("resize", updateDistance);

    return () => {
      window.removeEventListener("scroll", updateDistance);
      window.removeEventListener("resize", updateDistance);
    };
  }, [threshold]);

  return showFloatButton;
 
}
