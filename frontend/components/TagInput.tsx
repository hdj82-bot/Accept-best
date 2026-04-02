"use client";

import { useRef, useState } from "react";

interface TagInputProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder = "태그 입력 후 Enter",
  disabled = false,
}: TagInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const tag = value.trim().toLowerCase();
    if (!tag) return;
    if (!tags.includes(tag)) {
      onAdd(tag);
    }
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && value === "" && tags.length > 0) {
      onRemove(tags[tags.length - 1]);
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200 dark:border-slate-600 dark:bg-slate-800"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        >
          #{tag}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tag);
              }}
              className="ml-0.5 text-blue-400 hover:text-blue-700 dark:hover:text-blue-200"
              aria-label={`태그 '${tag}' 제거`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
        />
      )}
    </div>
  );
}
