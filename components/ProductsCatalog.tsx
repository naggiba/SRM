"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import type { Product, ProductPhoto } from "@/lib/schema";
import { normalizeImageForUpload } from "@/lib/compress";
import { uploadFile, type UploadResult } from "@/lib/upload-helper";

// Товар з розпарсеним масивом фото
type ProductItem = Omit<Product, "photoPaths"> & { photoPaths: ProductPhoto[] };

function normalizeProduct(p: Product | ProductItem): ProductItem {
  let photoPaths: ProductPhoto[] = [];
  const raw = (p as unknown as { photoPaths?: unknown }).photoPaths;
  if (Array.isArray(raw)) {
    photoPaths = raw.map((x) => ({
      url: (x as ProductPhoto).url ?? (x as string),
      previewUrl: (x as ProductPhoto).previewUrl ?? (x as ProductPhoto).url ?? (x as string),
    }));
  } else if (typeof raw === "string") {
    try {
      const arr = JSON.parse(raw);
      photoPaths = Array.isArray(arr) ? arr : [];
    } catch { /* ignore */ }
  }
  // Legacy: якщо є лише photoPath, показуємо його як єдине фото
  if (photoPaths.length === 0 && p.photoPath) {
    photoPaths = [{ url: p.photoPath, previewUrl: p.photoPath }];
  }
  return { ...p, photoPaths } as ProductItem;
}

export default function ProductsCatalog({
  initialProducts,
  canEdit,
  canDelete,
}: {
  initialProducts: Product[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [list, setList] = useState<ProductItem[]>(initialProducts.map(normalizeProduct));
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Збираємо унікальних постачальників з усіх товарів
  const allSuppliers = Array.from(
    new Set(initialProducts.map((p) => p.supplier?.trim()).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));

  const fetchProducts = useCallback(async (q: string) => {
    const res = await fetch(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) {
      const data: Product[] = await res.json();
      setList(data.map(normalizeProduct));
      if (q) {
        setOpenGroups(new Set(data.map((p) => p.supplier ?? "Без постачальника")));
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchProducts]);

  const grouped = list.reduce<Record<string, ProductItem[]>>((acc, product) => {
    const key = product.supplier?.trim() || "Без постачальника";
    if (!acc[key]) acc[key] = [];
    acc[key].push(product);
    return acc;
  }, {});

  const supplierNames = Object.keys(grouped).sort((a, b) => {
    if (a === "Без постачальника") return 1;
    if (b === "Без постачальника") return -1;
    return a.localeCompare(b);
  });

  function toggleGroup(supplier: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(supplier)) next.delete(supplier);
      else next.add(supplier);
      return next;
    });
  }

  function expandAll() { setOpenGroups(new Set(supplierNames)); }
  function collapseAll() { setOpenGroups(new Set()); }

  async function handleDelete(id: string) {
    if (!confirm("Видалити товар з каталогу?")) return;
    setLoading(true);
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    setList((p) => p.filter((x) => x.id !== id));
    setLoading(false);
  }

  function handleSaved(product: ProductItem) {
    setList((prev) => {
      const exists = prev.find((p) => p.id === product.id);
      if (exists) return prev.map((p) => (p.id === product.id ? product : p));
      return [product, ...prev];
    });
    const supplier = product.supplier?.trim() || "Без постачальника";
    setOpenGroups((prev) => new Set([...prev, supplier]));
    setShowForm(false);
    setEditProduct(null);
  }

  // Відкрити форму для конкретного постачальника
  function handleAddToSupplier(supplierName: string) {
    setEditProduct(null);
    setShowForm(true);
    // Передаємо постачальника через стан — форма підхопить
    setPreselectedSupplier(supplierName === "Без постачальника" ? "" : supplierName);
  }

  const [preselectedSupplier, setPreselectedSupplier] = useState("");

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за моделлю, постачальником..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={expandAll} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition">
            Розгорнути
          </button>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition">
            Згорнути
          </button>
          {canEdit && (
            <button
              onClick={() => { setEditProduct(null); setPreselectedSupplier(""); setShowForm(true); }}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              + Новий товар
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <ProductForm
          product={editProduct}
          suppliers={allSuppliers}
          preselectedSupplier={preselectedSupplier}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditProduct(null); }}
        />
      )}

      {/* Акордеон */}
      {list.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {search ? "Нічого не знайдено" : "Каталог порожній — додайте перший товар"}
        </div>
      ) : (
        <div className="space-y-2">
          {supplierNames.map((supplier) => {
            const products = grouped[supplier];
            const isOpen = openGroups.has(supplier);
            return (
              <div key={supplier} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleGroup(supplier)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{supplier}</p>
                      <p className="text-xs text-gray-400">{products.length} {products.length === 1 ? "товар" : products.length < 5 ? "товари" : "товарів"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <span
                        onClick={(e) => { e.stopPropagation(); handleAddToSupplier(supplier); }}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition cursor-pointer"
                      >
                        + Додати
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 p-3">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                      {products.map((product) => {
                        const photo = product.photoPaths[0];
                        const mainSrc = photo?.previewUrl || product.photoPath || "";
                        const count = product.photoPaths.length || (product.photoPath ? 1 : 0);
                        return (
                          <div key={product.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:shadow-sm transition">
                            <div className="relative aspect-square bg-gray-100">
                              {mainSrc ? (
                                <Image src={mainSrc} alt={product.modelNumber} fill className="object-cover" unoptimized />
                              ) : (
                                <div className="flex items-center justify-center h-full text-gray-300">
                                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              {count > 1 && (
                                <span className="absolute top-1 right-1 bg-black/60 text-white text-[10px] leading-none px-1.5 py-0.5 rounded">
                                  ×{count}
                                </span>
                              )}
                            </div>
                            <div className="p-2">
                              <p className="font-mono text-xs font-semibold text-gray-800 truncate">{product.modelNumber}</p>
                              {product.price && <p className="text-xs font-medium text-green-700 mt-0.5">{product.price}</p>}
                              {product.note && <p className="text-xs text-gray-400 truncate mt-0.5">{product.note}</p>}
                              {(canEdit || canDelete) && (
                                <div className="flex gap-2 mt-2 pt-1.5 border-t border-gray-200">
                                  {canEdit && (
                                    <button onClick={() => { setEditProduct(product); setPreselectedSupplier(""); setShowForm(true); }} className="text-xs text-blue-600 hover:underline">Ред.</button>
                                  )}
                                  {canDelete && (
                                    <button onClick={() => handleDelete(product.id)} disabled={loading} className="text-xs text-red-500 hover:underline ml-auto">Вид.</button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">Всього товарів: {list.length} | Постачальників: {supplierNames.length}</p>
    </div>
  );
}


// ── Форма з випадаючим списком постачальників ────────────────────────────────

function ProductForm({
  product,
  suppliers,
  preselectedSupplier,
  onSaved,
  onCancel,
}: {
  product: ProductItem | null;
  suppliers: string[];
  preselectedSupplier: string;
  onSaved: (p: ProductItem) => void;
  onCancel: () => void;
}) {
  const [modelNumber, setModelNumber] = useState(product?.modelNumber ?? "");
  const [supplier, setSupplier] = useState(product?.supplier ?? preselectedSupplier ?? "");
  const [price, setPrice] = useState(product?.price ?? "");
  const [note, setNote] = useState(product?.note ?? "");
  const [photos, setPhotos] = useState<ProductPhoto[]>(() => {
    if (!product) return [];
    return normalizeProduct(product).photoPaths;
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Supplier dropdown
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const supplierRef = useRef<HTMLDivElement>(null);

  const filteredSuppliers = suppliers.filter((s) =>
    s.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const isNewSupplier = supplierSearch.trim() && !suppliers.some(
    (s) => s.toLowerCase() === supplierSearch.trim().toLowerCase()
  );

  // Закрити dropdown при кліку зовні
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setSupplierOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectSupplier(name: string) {
    setSupplier(name);
    setSupplierSearch("");
    setSupplierOpen(false);
  }

  function handleSupplierInputFocus() {
    setSupplierOpen(true);
    setSupplierSearch("");
  }

  function handleSupplierInputChange(val: string) {
    setSupplierSearch(val);
    setSupplier(val);
    if (!supplierOpen) setSupplierOpen(true);
  }

  async function handlePhotos(files: FileList) {
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const original = await normalizeImageForUpload(file);
        const result: UploadResult = await uploadFile(original);
        setPhotos((prev) => [...prev, { url: result.originalUrl, previewUrl: result.previewUrl }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження фото");
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!modelNumber.trim()) {
      setError("Номер моделі обов'язковий");
      return;
    }

    setSaving(true);

    const body = {
      modelNumber: modelNumber.trim(),
      supplier: supplier.trim() || null,
      price: price.trim() || null,
      note: note.trim() || null,
      photoPaths: photos,
      photoPath: photos[0]?.url ?? null,
    };

    try {
      const res = product
        ? await fetch(`/api/products/${product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Помилка збереження");
      }

      const saved = await res.json();
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка збереження");
    }
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
      <h2 className="font-semibold text-gray-800 mb-4">
        {product ? "Редагувати товар" : "Новий товар"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Фото (галерея) */}
        <div>
          <div className="flex flex-wrap gap-2.5">
            {photos.map((photo, i) => (
              <div key={i} className="relative w-24 h-24">
                <Image src={photo.previewUrl} alt={`Фото ${i + 1}`} fill className="object-cover rounded-lg border border-gray-200" unoptimized />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs leading-none flex items-center justify-center shadow"
                  title="Видалити фото"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => document.getElementById("product-photos-input")?.click()}
              disabled={uploading}
              className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition disabled:opacity-50"
              title="Додати фото"
            >
              {uploading ? (
                <span className="text-xs text-gray-500">Завантаження...</span>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </button>
          </div>
          <input
            id="product-photos-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files?.length) handlePhotos(e.target.files); }}
          />
          {photos.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">Додайте одне або кілька фото товару.</p>
          )}
        </div>

        {/* Поля */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Номер моделі <span className="text-red-500">*</span>
            </label>
            <input
              value={modelNumber}
              onChange={(e) => setModelNumber(e.target.value)}
              required
              placeholder="ABC-12345"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
            />
          </div>

          {/* Постачальник з dropdown */}
          <div ref={supplierRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Постачальник</label>
            <input
              value={supplierOpen ? supplierSearch || supplier : supplier}
              onChange={(e) => handleSupplierInputChange(e.target.value)}
              onFocus={handleSupplierInputFocus}
              placeholder="Обрати або ввести нового..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {supplier && !supplierOpen && (
              <button
                type="button"
                onClick={() => { setSupplier(""); setSupplierSearch(""); }}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}

            {supplierOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => selectSupplier(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate"
                    >
                      {s}
                    </button>
                  ))
                ) : (
                  !isNewSupplier && <p className="px-3 py-2 text-xs text-gray-400">Немає постачальників</p>
                )}
                {isNewSupplier && (
                  <button
                    type="button"
                    onClick={() => selectSupplier(supplierSearch.trim())}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition border-t border-gray-100"
                  >
                    + Створити &quot;{supplierSearch.trim()}&quot;
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ціна</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="150 ¥"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Нотатка</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Додаткова інформація"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Скасувати
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition"
          >
            {saving ? "Збереження..." : uploading ? "Завантаження фото..." : "Зберегти"}
          </button>
        </div>
      </form>
    </div>
  );
}
