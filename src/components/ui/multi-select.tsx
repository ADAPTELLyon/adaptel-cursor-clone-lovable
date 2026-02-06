import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({ options, selected, onChange, placeholder, className }: MultiSelectProps) {
  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option))
    } else {
      onChange([...selected, option])
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "w-full justify-between",
            selected.length === 0 && "text-muted-foreground",
            className
          )}
        >
          {selected.length > 0 ? `${selected.length} sélectionné(s)` : placeholder || "Sélectionner"}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="z-[9999] w-[320px] sm:w-[360px] p-2 max-h-60 overflow-y-auto"
        align="start"
      >
        {options.map((option) => (
          <div
            key={option}
            className="flex items-center px-2 py-1.5 cursor-pointer rounded hover:bg-accent"
            onClick={() => toggleOption(option)}
          >
            <Check className={cn("mr-2 h-4 w-4", selected.includes(option) ? "opacity-100" : "opacity-0")} />
            <span>{option}</span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
