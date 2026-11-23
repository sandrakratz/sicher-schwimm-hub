import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Einfaches Auswahlfeld des Browsers (<select>) im Stil der übrigen Formularfelder.
 * Für kurze Listen und Filter; leere Werte ("") sind erlaubt (im Gegensatz zu `ui/select`).
 */
const sizes = {
  xs: "h-8 px-2 text-xs",
  sm: "h-8 px-2 text-sm",
  md: "h-9 px-2 text-sm",
  lg: "h-10 px-3 text-sm",
} as const;

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: keyof typeof sizes;
};

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, size = "md", ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
