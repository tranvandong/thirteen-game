import * as React from "react"
import { cn } from "~/lib/utils"
import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"
import { User, Bot } from "lucide-react"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"

const chatBubbleVariants = cva(
  "flex gap-3 max-w-[85%] sm:max-w-[75%]",
  {
    variants: {
      variant: {
        user: "self-end flex-row-reverse",
        assistant: "self-start flex-row",
        system: "self-center",
      },
    },
    defaultVariants: {
      variant: "assistant",
    },
  }
)

const chatBubbleMessageVariants = cva(
  "rounded-3xl px-4 py-2.5 text-sm leading-relaxed",
  {
    variants: {
      variant: {
        user: "bg-primary text-primary-foreground rounded-br-sm",
        assistant:
          "bg-muted text-foreground rounded-bl-sm border border-border/60",
        system:
          "bg-muted/50 text-muted-foreground rounded-2xl border border-border/40 text-center",
      },
    },
    defaultVariants: {
      variant: "assistant",
    },
  }
)

interface ChatBubbleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatBubbleVariants> {
  avatar?: React.ReactNode
  showAvatar?: boolean
}

function ChatBubble({
  className,
  variant = "assistant",
  avatar,
  showAvatar = true,
  children,
  ...props
}: ChatBubbleProps) {
  return (
    <div
      className={cn(chatBubbleVariants({ variant }), className)}
      {...props}
    >
      {showAvatar && (
        <div className="shrink-0">
          {avatar ?? (
            <Avatar>
              <AvatarFallback
                className={
                  variant === "user"
                    ? "bg-primary/15 text-primary"
                    : variant === "system"
                      ? "bg-muted text-muted-foreground"
                      : "bg-chart-4/15 text-chart-4"
                }
              >
                {variant === "user" ? (
                  <User className="size-4" />
                ) : variant === "system" ? (
                  <span className="text-[10px] font-bold">SYS</span>
                ) : (
                  <Bot className="size-4" />
                )}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-1 min-w-0",
          variant === "user" ? "items-end" : "items-start"
        )}
      >
        {children}
      </div>
    </div>
  )
}

interface ChatBubbleMessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatBubbleMessageVariants> {
  showAvatar?: boolean
}

function ChatBubbleMessage({
  className,
  variant = "assistant",
  showAvatar = true,
  children,
  ...props
}: ChatBubbleMessageProps) {
  return (
    <div
      className={cn(chatBubbleMessageVariants({ variant }), className)}
      {...props}
    >
      {typeof children === "string" ? (
        <p className="whitespace-pre-wrap break-words">{children}</p>
      ) : (
        children
      )}
    </div>
  )
}

interface ChatBubbleAvatarProps
  extends React.ComponentProps<typeof Avatar> {}

function ChatBubbleAvatar({ className, ...props }: ChatBubbleAvatarProps) {
  return <Avatar className={cn("size-8", className)} {...props} />
}

interface ChatBubbleAvatarFallbackProps
  extends React.ComponentProps<typeof AvatarFallback> {}

function ChatBubbleAvatarFallback({
  className,
  ...props
}: ChatBubbleAvatarFallbackProps) {
  return (
    <AvatarFallback
      className={cn("text-[10px]", className)}
      {...props}
    />
  )
}

export {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleAvatarFallback,
  ChatBubbleMessage,
  chatBubbleVariants,
  chatBubbleMessageVariants,
}
