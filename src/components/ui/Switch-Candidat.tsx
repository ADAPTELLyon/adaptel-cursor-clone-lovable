import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const switchBase = cva(
  "peer inline-flex h-[22px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[#a9d08e] data-[state=unchecked]:bg-input"
)

const thumbBase = "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"

export function SwitchCandidat({ className, ...props }: SwitchPrimitives.SwitchProps) {
  return (
    <SwitchPrimitives.Root className={cn(switchBase(), className)} {...props}>
      <SwitchPrimitives.Thumb className={thumbBase} />
    </SwitchPrimitives.Root>
  )
}
