import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Unsichtbares Spam-Schutzfeld (Honeypot). Bots füllen es aus, Menschen nicht.
 * Der Wert wird beim Absenden mitgeschickt und serverseitig geprüft.
 */
export function HoneypotField({
  value,
  onChange,
  name = "website",
}: {
  value: string;
  onChange: (v: string) => void;
  name?: string;
}) {
  return (
    <div className="hidden" aria-hidden="true">
      <label>
        Bitte leer lassen:
        <input
          type="text"
          name={name}
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

/** Feldbezogene Fehlermeldung unter einem Eingabefeld. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-sm text-destructive mt-1">
      {message}
    </p>
  );
}

/** Label + Feld + Fehlermeldung mit korrekter Verknüpfung für Screenreader. */
export function FormField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={error ? "text-destructive" : undefined}>
        {label}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError id={id} message={error} />
    </div>
  );
}

/** Ganzflächig klickbare Checkbox-Zeile mit optionaler Fehlermeldung. */
export function ConsentCheckbox({
  id,
  name,
  checked,
  onCheckedChange,
  required,
  error,
  className,
  children,
}: {
  id: string;
  name?: string;
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-md", error && "ring-1 ring-destructive/40", className)}>
      <div className="flex items-start gap-3 p-2 -m-2 rounded-md">
        <Checkbox
          id={id}
          name={name}
          required={required}
          checked={checked}
          onCheckedChange={onCheckedChange ? (v) => onCheckedChange(v === true) : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-5 w-5"
        />
        <div className="flex-1 min-w-0">
          <Label htmlFor={id} className="text-sm font-normal leading-snug cursor-pointer block">
            {children}
          </Label>
          <FieldError id={id} message={error} />
        </div>
      </div>
    </div>
  );
}

/** Absende-Button mit Spinner und aria-busy. */
export function SubmitButton({
  loading,
  children,
  loadingText,
  className,
  variant = "accent",
  size = "lg",
  ...rest
}: React.ComponentProps<typeof Button> & { loading?: boolean; loadingText?: string }) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={loading || rest.disabled}
      aria-busy={loading ? true : undefined}
      {...rest}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {loading ? (loadingText ?? "Wird gesendet…") : children}
    </Button>
  );
}
