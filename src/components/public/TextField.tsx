import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Beschriftung + Eingabefeld. `className` gilt für den umgebenden Block,
 * alle übrigen Angaben gehen an das Eingabefeld.
 */
export function TextField({
  id,
  label,
  className,
  ...input
}: { id?: string; label: ReactNode; className?: string } & Omit<
  ComponentProps<typeof Input>,
  "className" | "id"
>) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...input} />
    </div>
  );
}
