import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "input input-bordered h-9 w-full min-w-0 text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
