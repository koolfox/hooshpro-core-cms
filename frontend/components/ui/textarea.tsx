import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "textarea textarea-bordered min-h-20 w-full text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
