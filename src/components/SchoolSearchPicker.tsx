"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SchoolSearchResult } from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectedSchool {
  id: string;
  name: string;
}

interface SchoolSearchPickerProps {
  selected: SelectedSchool[];
  onChange: (schools: SelectedSchool[]) => void;
  max?: number;
}

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SchoolSearchPicker({
  selected,
  onChange,
  max = 3,
}: SchoolSearchPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SchoolSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query.trim(), 300);

  // Search whenever debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    fetch("/api/schools/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: debouncedQuery }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setResults([]);
          setOpen(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const list: SchoolSearchResult[] = data.results ?? [];
        // Filter out already-selected schools
        const selectedIds = new Set(selected.map((s) => s.id));
        setResults(list.filter((r) => !selectedIds.has(r.id)));
        setOpen(list.length > 0);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
        setOpen(false);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addSchool = useCallback(
    (school: SchoolSearchResult) => {
      if (selected.length >= max) return;
      if (selected.some((s) => s.id === school.id)) return;
      onChange([...selected, { id: school.id, name: school.name }]);
      setQuery("");
      setResults([]);
      setOpen(false);
      inputRef.current?.focus();
    },
    [selected, onChange, max]
  );

  const removeSchool = useCallback(
    (id: string) => {
      onChange(selected.filter((s) => s.id !== id));
    },
    [selected, onChange]
  );

  const atMax = selected.length >= max;

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((school) => (
            <span
              key={school.id}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-900 text-sm font-medium border border-indigo-200"
            >
              {school.name}
              <button
                type="button"
                onClick={() => removeSchool(school.id)}
                aria-label={`Remove ${school.name}`}
                className="text-indigo-500 hover:text-indigo-800 leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input + dropdown */}
      {!atMax && (
        <div ref={containerRef} className="relative">
          <div className="relative">
            <input
              ref={inputRef}
              id="school-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (results.length > 0) setOpen(true);
              }}
              placeholder="Search by school name…"
              autoComplete="off"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-8 text-sm text-gray-900 bg-white shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searching && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <svg
                  className="animate-spin h-4 w-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </span>
            )}
          </div>

          {open && results.length > 0 && (
            <ul
              ref={listRef}
              role="listbox"
              aria-label="School search results"
              className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto"
            >
              {results.map((school) => (
                <li
                  key={school.id}
                  role="option"
                  aria-selected={false}
                >
                  <button
                    type="button"
                    onClick={() => addSchool(school)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                  >
                    <span className="block text-sm font-medium text-gray-900">
                      {school.name}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {school.city}, {school.state} &middot;{" "}
                      {school.control === "public" ? "Public" : "Private"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {atMax && (
        <p className="text-xs text-gray-500">
          Maximum of {max} schools selected. Remove one to add another.
        </p>
      )}

      {!atMax && selected.length === 0 && (
        <p className="text-xs text-gray-400">
          Type at least 2 characters to search. Up to {max} schools.
        </p>
      )}

      {!atMax && selected.length > 0 && (
        <p className="text-xs text-gray-400">
          {max - selected.length} more school{max - selected.length !== 1 ? "s" : ""} can be added.
        </p>
      )}
    </div>
  );
}
