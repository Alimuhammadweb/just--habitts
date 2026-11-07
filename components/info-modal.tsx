"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface InfoModalProps {
  title: string
  children: React.ReactNode
  onClose: () => void
}

export function InfoModal({ title, children, onClose }: InfoModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
