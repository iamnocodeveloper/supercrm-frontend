import React from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { DateRange } from '@/services/reportsService';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onRangeChange: (range: DateRange) => void;
  onPresetSelect: (preset: 'today' | '7days' | '30days' | 'thisMonth') => void;
}

const presets = [
  { id: 'today' as const, label: 'Hoy' },
  { id: '7days' as const, label: '7 días' },
  { id: '30days' as const, label: '30 días' },
  { id: 'thisMonth' as const, label: 'Este mes' },
];

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  dateRange,
  onRangeChange,
  onPresetSelect
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      onRangeChange({
        startDate: range.from,
        endDate: range.to
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Presets */}
      <div className="flex gap-1">
        {presets.map(preset => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => onPresetSelect(preset.id)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom date picker */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {dateRange?.startDate ? (
              <>
                {format(dateRange.startDate, 'dd MMM', { locale: es })} - {format(dateRange.endDate, 'dd MMM yyyy', { locale: es })}
              </>
            ) : (
              <span>Seleccionar fechas</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <CalendarComponent
            initialFocus
            mode="range"
            defaultMonth={dateRange?.startDate}
            selected={{
              from: dateRange?.startDate,
              to: dateRange?.endDate
            }}
            onSelect={handleSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
