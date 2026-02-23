"use client";

import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TooltipLabelProps {
  children: React.ReactNode;
  tooltip: string;
  htmlFor?: string;
}

export function TooltipLabel({ children, tooltip, htmlFor }: TooltipLabelProps) {
  return (
    <Label htmlFor={htmlFor} className="inline-flex items-center gap-1">
      {children}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Label>
  );
}
