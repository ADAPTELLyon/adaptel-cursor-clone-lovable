
"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"

type Option = {
  value: string
  label: string
}

interface MultiSelectProps {
  options: Option[]
  value?: string[]
  onChange?: (value: string[]) => void
  placeholder?: string
}

export function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = "Sélectionner...",
}: MultiSelectProps) {
  // Ensure value is always a valid array
  const [selected, setSelected] = React.useState<string[]>(Array.isArray(value) ? value : [])
  
  // Update local state when prop changes
  React.useEffect(() => {
    if (Array.isArray(value)) {
      setSelected(value)
    }
  }, [value])

  const handleSelect = (option: string) => {
    const updatedValue = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option]
    
    setSelected(updatedValue)
    onChange?.(updatedValue)
  }

  const handleRemove = (option: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const updatedValue = selected.filter((item) => item !== option)
    setSelected(updatedValue)
    onChange?.(updatedValue)
  }

  // Ensure we have valid options
  const safeOptions = options || []

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between h-auto min-h-[42px]"
        >
          <div className="flex flex-wrap gap-1.5 py-0.5">
            {selected.length > 0 ? (
              selected.map((option) => {
                const selectedOption = safeOptions.find((o) => o.value === option)
                return (
                  <Badge
                    key={option}
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedOption?.label || option}
                    <button
                      className="ml-1.5 rounded-sm hover:bg-muted"
                      onClick={(e) => handleRemove(option, e)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )
              })
            ) : (
              <span className="text-muted-foreground text-sm">{placeholder}</span>
            )}
          </div>
          <span className="sr-only">Toggle menu</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="max-h-60 overflow-auto p-1">
          {safeOptions.length > 0 ? (
            safeOptions.map((option) => (
              <div
                key={option.value}
                className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                onClick={() => handleSelect(option.value)}
              >
                <Checkbox
                  checked={selected.includes(option.value)}
                  className="pointer-events-none"
                />
                <span>{option.label}</span>
              </div>
            ))
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              Aucune option disponible
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
