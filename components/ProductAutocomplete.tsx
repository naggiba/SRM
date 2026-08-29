"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { Product } from "@/lib/schema";

interface Props {
  modelNumber: string;
  supplier: string;
  price: string;
  onSelect: (data: { modelNumber: string; supplier: string; price: string; photoPath?: string }) => void;
  onChange: (field: "modelNumber" | "supplier" | "price", value: string) => void;
}

export default function ProductAutocomplete({ modelNumber, supplier, price, onSelect, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Пошук при введенні номера моделі
  useEffect(() => {
    if (!modelNumber || modelNumber.length < 1) {
      const timer = setTimeout(() => setSuggestions([]), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(modelNumber)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.slice(0, 6));
          setShowSuggestions(data.length > 0);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [modelNumber]);

  // Закриваємо при кліку зовні
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(product: Product) {
    onSelect({
      modelNumber: product.modelNumber,
      supplier: product.supplier ?? "",
      price: product.price ?? "",
      photoPath: product.photoPath ?? undefined,
    });
    setShowSuggestions(false);
  }

  return (
    <div className="grid grid-cols-2 gap-3" ref={containerRef}>
      {/* Постачальник */}
      <input
        value={supplier}
        onChange={(e) => onChange("supplier", e.target.value)}
        placeholder="Постачальник"
        className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
      />

      {/* Номер моделі з автодоповненням */}
      <div className="relative">
        <input
          value={modelNumber}
          onChange={(e) => {
            onChange("modelNumber", e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => modelNumber && setShowSuggestions(suggestions.length > 0)}
          placeholder="Номер моделі"
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm font-mono"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-2 top-2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}

        {/* Список підказок */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 transition text-left"
              >
                {/* Мініатюра фото */}
                <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {p.photoPath ? (
                    <Image src={p.photoPath} alt={p.modelNumber} width={40} height={40} className="object-cover w-full h-full" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-semibold text-gray-800 truncate">{p.modelNumber}</p>
                  <div className="flex gap-2 text-xs text-gray-500">
                    {p.supplier && <span className="truncate">{p.supplier}</span>}
                    {p.price && <span className="text-green-700 font-medium">{p.price}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ціна */}
      <input
        value={price}
        onChange={(e) => onChange("price", e.target.value)}
        placeholder="Ціна за одиницю"
        className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
      />
    </div>
  );
}
