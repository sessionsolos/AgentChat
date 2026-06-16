"use client";

import { useState, useRef, KeyboardEvent } from "react";

interface TagInputProps {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  quickAdd?: string[];
  error?: string;
}

export function TagInput({
  id,
  label,
  values,
  onChange,
  placeholder = "Type and press Enter or comma",
  quickAdd,
  error,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (tag && !values.includes(tag)) {
      onChange([...values, tag]);
    }
    setInputValue("");
  };

  const removeTag = (tag: string) => {
    onChange(values.filter((v) => v !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && values.length > 0) {
      removeTag(values[values.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) addTag(inputValue);
  };

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
      </label>

      {/* Tag container / input area */}
      <div
        className={`min-h-[2.625rem] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-md border bg-white cursor-text transition-colors ${
          error
            ? "border-red-400 ring-1 ring-red-400"
            : "border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-sm font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              aria-label={`Remove ${tag}`}
              className="text-blue-500 hover:text-blue-700 leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] border-0 p-0 text-sm bg-transparent placeholder-gray-400 focus:outline-none focus:ring-0"
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error}
        />
      </div>

      {/* Quick-add chips */}
      {quickAdd && quickAdd.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickAdd
            .filter((q) => !values.includes(q.toLowerCase()))
            .map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => addTag(q)}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                + {q}
              </button>
            ))}
        </div>
      )}

      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
