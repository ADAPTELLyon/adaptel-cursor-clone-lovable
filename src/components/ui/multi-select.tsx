
"use client"

import * as React from "react"
import { X, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Command as CommandPrimitive } from "cmdk"
import { useClickOutside } from "@/hooks/use-click-outside"

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
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<string[]>(value)
  const [inputValue, setInputValue] = React.useState("")

  useClickOutside(containerRef, () => setOpen(false))

  React.useEffect(() => {
    setSelected(value)
  }, [value])

  const handleSelect = (option: string) => {
    const updatedValue = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option]
    
    setSelected(updatedValue)
    onChange?.(updatedValue)
  }

  const handleRemove = (option: string) => {
    const updatedValue = selected.filter((item) => item !== option)
    setSelected(updatedValue)
    onChange?.(updatedValue)
  }

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className="relative flex min-h-[42px] w-full items-center gap-1.5 rounded-md border border-input bg-background p-1.5 text-sm ring-offset-background cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => {
            const selectedOption = options.find((o) => o.value === option)
            return (
              <Badge
                key={option}
                variant="secondary"
                className="rounded-sm px-1 font-normal"
              >
                {selectedOption?.label || option}
                <button
                  className="ml-1.5 rounded-sm hover:bg-muted"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRemove(option)
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(option)
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
          {selected.length === 0 && (
            <span className="text-muted-foreground text-sm">
              {placeholder}
            </span>
          )}
        </div>
      </div>
      {open && (
        <div className="absolute mt-1 w-full z-10">
          <Command className="rounded-md border bg-popover text-popover-foreground shadow-md animate-in">
            <CommandInput 
              placeholder="Rechercher..." 
              value={inputValue}
              onValueChange={setInputValue}
              className="h-9"
            />
            <CommandEmpty className="py-2 px-4 text-sm text-muted-foreground">
              Aucun résultat trouvé
            </CommandEmpty>
            <CommandGroup className="max-h-60 overflow-auto">
              {options.map((option) => {
                const isSelected = selected.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                  >
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                        isSelected ? "bg-primary border-primary" : "border-primary"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    {option.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </Command>
        </div>
      )}
    </div>
  )
}
