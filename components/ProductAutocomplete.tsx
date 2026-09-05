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
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Список постачальників та товарів з каталогу ──
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const supplierRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((r) => r.json())
      .then((data: Product[]) => {
        if (cancelled) return;
        setAllProducts(data);
        const s = Array.from(new Set(data.map((p) => p.supplier?.trim()).filter(Boolean))) as string[];
        setSuppliers(s.sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const filteredSuppliers = suppliers.filter((s) =>
    s.toLowerCase().includes(supplierQuery.toLowerCase())
  );

  // Закриваємо dropdown постачальника при кліку зовні
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setSupplierOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Моделі обраного постачальника з каталогу (клієнтська фільтрація)
  const supplierNorm = (supplier.trim() || "Без постачальника").toLowerCase();
  const modelQuery = modelNumber.trim().toLowerCase();
  const supplierModels = allProducts
    .filter((p) => (p.supplier?.trim() || "Без постачальника").toLowerCase() === supplierNorm)
    .filter((p) => !modelQuery || p.modelNumber.toLowerCase().includes(modelQuery));

  // Пошук по API — лише коли постачальник не обраний
  useEffect(() => {
    if (supplier) return; // при обраному постачальнику фільтруємо клієнтськи
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
          setSuggestions(data.slice(0, 8));
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [modelNumber, supplier]);

  // Список, який показуємо: моделі постачальника або результати пошуку
  const displayModels = supplier ? supplierModels : suggestions;
  const showModels = modelOpen && displayModels.length > 0;

  // Закриваємо dropdown моделі при кліку зовні
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setModelOpen(false);
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
    setModelOpen(false);
  }

  function selectSupplier(name: string) {
    onChange("supplier", name);
    setSupplierQuery("");
    setSupplierOpen(false);
    // після вибору постачальника одразу відкриваємо список його моделей
    setModelOpen(true);
  }

  return (
    <div className="grid grid-cols-2 gap-3" ref={containerRef}>
      {/* Постачальник з dropdown */}
      <div className="relative" ref={supplierRef}>
        <input
          value={supplierOpen ? supplierQuery || supplier : supplier}
          onChange={(e) => {
            setSupplierQuery(e.target.value);
            onChange("supplier", e.target.value);
            setSupplierOpen(true);
          }}
          onFocus={() => { setSupplierOpen(true); setSupplierQuery(""); }}
          placeholder="Постачальник"
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
          autoComplete="off"
        />
        {supplier && !supplierOpen && (
          <button
            type="button"
            onClick={() => { onChange("supplier", ""); setSupplierQuery(""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          >
            ✕
          </button>
        )}

        {supplierOpen && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-auto max-h-48">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => selectSupplier(s)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition truncate"
                >
                  {s}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-gray-400">Немає постачальників</p>
            )}
            {supplierQuery.trim() && !suppliers.some((s) => s.toLowerCase() === supplierQuery.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => {
                  onChange("supplier", supplierQuery.trim());
                  setSupplierQuery("");
                  setSupplierOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 transition border-t border-gray-100"
              >
                + Створити &quot;{supplierQuery.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>

      {/* Номер моделі: список моделей обраного постачальника / пошук */}
      <div className="relative">
        <input
          value={modelNumber}
          onChange={(e) => {
            onChange("modelNumber", e.target.value);
            setModelOpen(true);
          }}
          onFocus={() => setModelOpen(true)}
          placeholder={supplier ? "Оберіть модель" : "Номер моделі"}
          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm font-mono"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-2 top-2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}

        {showModels && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-auto max-h-56">
            {displayModels.map((p) => (
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

        {modelOpen && supplier && supplierModels.length === 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <p className="px-3 py-2 text-xs text-gray-400">Немає моделей у цього постачальника в каталозі</p>
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
