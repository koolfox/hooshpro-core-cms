import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "hero rounded-box border border-dashed border-base-300 bg-base-100 p-6 md:p-10",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="empty-header" className={cn("mx-auto flex max-w-xl flex-col items-center gap-2 text-center", className)} {...props} />
}

const emptyMediaVariants = cva("flex shrink-0 items-center justify-center mb-2", {
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "bg-base-200 text-base-content flex size-12 items-center justify-center rounded-box",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div data-slot="empty-icon" data-variant={variant} className={cn(emptyMediaVariants({ variant, className }))} {...props} />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="empty-title" className={cn("text-lg font-semibold", className)} {...props} />
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <div data-slot="empty-description" className={cn("text-base-content/70 text-sm", className)} {...props} />
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="empty-content" className={cn("mx-auto flex w-full max-w-xl flex-col items-center gap-4", className)} {...props} />
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}
