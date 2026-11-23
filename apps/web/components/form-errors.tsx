"use client";

import { useEffect, useRef } from "react";

/** Liste d'erreurs annoncée aux lecteurs d'écran et focalisée à son apparition. */
export function FormErrors({ messages }: { messages: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messages.length) ref.current?.focus();
  }, [messages]);
  if (!messages.length) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="border-l-4 border-balise bg-white p-3 text-sm">
      <ul className="list-inside list-disc space-y-1">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

export const inputClass = "mt-1 min-h-11 w-full border border-asphalte/40 bg-white px-3";
export const buttonClass =
  "min-h-12 w-full bg-balise px-6 font-semibold text-craie hover:bg-balise/90 disabled:cursor-wait disabled:opacity-70";
