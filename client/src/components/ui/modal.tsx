import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function Modal({ isOpen, onClose, children, title }: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-[90vw] translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white dark:bg-gray-900 p-4 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            {title && <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>}
            <Dialog.Close className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="overflow-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
