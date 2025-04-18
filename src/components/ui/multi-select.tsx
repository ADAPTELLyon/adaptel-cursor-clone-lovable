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
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<string[]>(value)

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
      <div className="relative flex min-h-[42px] w-full items-center gap-1.5 rounded-md border border-input bg-background p-1.5 text-sm ring-offset-background">
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
                  onClick={() => handleRemove(option)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
        <CommandPrimitive onKeyDown={(e) => {
          if (e.key === "Backspace" && !e.currentTarget.value && selected.length > 0) {
            handleRemove(selected[selected.length - 1])
          }
        }}>
          <div className="flex-1">
            <CommandInput
              ref={inputRef}
              placeholder={placeholder}
              className="h-8 w-full border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              onFocus={() => setOpen(true)}
            />
          </div>
        </CommandPrimitive>
      </div>
      <div className="relative mt-1">
        {open && (
          <Command className="absolute top-0 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
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
        )}
      </div>
    </div>
  )
}
