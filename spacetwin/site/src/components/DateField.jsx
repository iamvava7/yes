import React, { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const toDate = (value) => {
  if (!value) return undefined;
  const d = value instanceof Date ? value : parseISO(value);
  return isValid(d) ? d : undefined;
};

/**
 * DateField — selector vizual de dată.
 *  • Popover + Calendar (react-day-picker) deschis la click pe întreaga casetă
 *  • arată placeholder text când e gol, data formatată când e selectată
 *  • tokens (`bg-background`, `dark:bg-card`) — lizibil pe ambele teme
 *  • funcționează consistent pe desktop și mobil (nu depinde de showPicker nativ)
 */
export default function DateField({
  value,
  onChange,
  placeholder = "Selectează o dată",
  className = "",
  min,
  max,
  disabled,
}) {
  const selected = useMemo(() => toDate(value), [value]);

  const handleSelect = (d) => {
    if (!d) { onChange?.({ target: { value: "" } }); return; }
    const iso = format(d, "yyyy-MM-dd");
    // Emulează evenimentul unui <input type="date"> pentru compatibilitate
    onChange?.({ target: { value: iso } });
  };

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="relative flex w-full items-center rounded-lg border border-border bg-background px-3 py-2 text-left outline-none transition focus:border-emerald dark:bg-card disabled:opacity-50"
            style={{ colorScheme: "light dark" }}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span
              className={`pointer-events-none select-none pl-2 text-sm ${
                value ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {value ? format(selected, "dd.MM.yyyy") : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            fromDate={min ? toDate(min) : undefined}
            toDate={max ? toDate(max) : undefined}
            disabled={disabled}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}