import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FileX2 } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";

type Variant = VariantProps<typeof buttonVariants>["variant"];
type Size = VariantProps<typeof buttonVariants>["size"];

export function CancellationButton({
  variant = "outline",
  size = "default",
  className,
  label = "Vertrag widerrufen",
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  label?: string;
}) {
  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={className}
    >
      <Link to="/widerruf" aria-label="Schwimmkurs-Vertrag widerrufen">
        <FileX2 className="mr-2 h-4 w-4" aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}
