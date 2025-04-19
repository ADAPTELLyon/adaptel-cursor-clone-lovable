
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
  // Initialize with empty array if value is null or undefined
  const [selected, setSelected] = React.useState<string[]>(value || [])
  const [open, setOpen] = React.useState(false)
  
  // Synchronize with external value changes
  React.useEffect(() => {
    if (Array.isArray(value)) {
      setSelected(value)
    }
  }, [value])

  const handleSelect = (optionValue: string) => {
    const updatedValue = selected.includes(optionValue)
      ? selected.filter((item) => item !== optionValue)
      : [...selected, optionValue]
    
    setSelected(updatedValue)
    onChange?.(updatedValue)
  }

  const handleRemove = (optionValue: string, e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    
    const updatedValue = selected.filter((item) => item !== optionValue)
    setSelected(updatedValue)
    onChange?.(updatedValue)
  }

  // Ensure we have valid options
  const safeOptions = options || []

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between h-auto min-h-[42px]"
        >
          <div className="flex flex-wrap gap-1.5 py-0.5">
            {selected.length > 0 ? (
              selected.map((optionValue) => {
                const selectedOption = safeOptions.find((o) => o.value === optionValue)
                return (
                  <Badge
                    key={optionValue}
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedOption?.label || optionValue}
                    <button
                      className="ml-1.5 rounded-sm hover:bg-muted"
                      onClick={(e) => handleRemove(optionValue, e)}
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
                  id={`option-${option.value}`}
                />
                <label 
                  htmlFor={`option-${option.value}`}
                  className="cursor-pointer flex-grow"
                >
                  {option.label}
                </label>
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
