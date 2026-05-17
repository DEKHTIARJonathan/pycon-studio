"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text: string;
}

export function TextDialog({ open, onOpenChange, title, text }: TextDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {text.replace(/\\n/g, "\n")}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
