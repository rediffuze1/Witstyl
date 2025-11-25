import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette } from "lucide-react";

const PRESET_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Rose
  "#f59e0b", // Ambre
  "#10b981", // Émeraude
  "#3b82f6", // Bleu
  "#ef4444", // Rouge
  "#14b8a6", // Turquoise
  "#f97316", // Orange
  "#a855f7", // Violet foncé
  "#06b6d4", // Cyan
  "#84cc16", // Lime
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
          >
            <div
              className="w-4 h-4 rounded mr-2 border"
              style={{ backgroundColor: value }}
            />
            <span className="text-sm">{value}</span>
            <Palette className="ml-auto h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Couleurs prédéfinies
              </Label>
              <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="w-8 h-8 rounded border-2 hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: color,
                      borderColor: value === color ? "#000" : "#e5e7eb",
                    }}
                    onClick={() => {
                      onChange(color);
                      setOpen(false);
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Couleur personnalisée
              </Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-10 w-20 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    const color = e.target.value;
                    if (/^#[0-9A-F]{6}$/i.test(color)) {
                      onChange(color);
                    }
                  }}
                  placeholder="#6366f1"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}





