"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import type { Product } from "@/lib/schema";
import { compressImage, formatFileSize } from "@/lib/compress";

export default function ProductsCatalog({
  initialProducts,
  canEdit,
  canDelete,
}: {
  initialProducts: Product[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [list, setList] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  // Зберігаємо які постачальники розгорнуті (за замовчуванням всі)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const fetchProducts = useCallback(async (q: string) => {
    const res = await fetch(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) {
      const data: Product[] = await res.json();
      setList(data);
      // При пошуку розгортаємо всі групи
      if (q) {
        const suppliers = new Set(data.map((p) => p.supplier ?? "Без постачальника"));
        setOpenGroups(suppliers);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchProducts]);

  // Групуємо по постачальнику
  const grouped = list.reduce<Record<string, Product[]>>((acc, product) => {
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

  function expandAll() {
    setOpenGroups(new Set(supplierNames));
  }

  function collapseAll() {
    setOpenGroups(new Set());
  }

  async function handleDelete(id: string) {
    if (!confirm("Видалити товар з каталогу?")) return;
    setLoading(true);
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    setList((p) => p.filter((x) => x.id !== id));
    setLoading(false);
  }

  function handleSaved(product: Product) {
    setList((prev) => {
      const exists = prev.find((p) => p.id === product.id);
      if (exists) return prev.map((p) => (p.id === product.id ? product : p));
      return [product, ...prev];
    });
    // Розгортаємо групу нового товару
    const supplier = product.supplier?.trim() || "Без постачальника";
    setOpenGroups((prev) => new Set([...prev, supplier]));
    setShowForm(false);
    setEditProduct(null);
  }

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
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition">
            Розгорнути всі
          </button>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition">
            Згорнути всі
          </button>
          {canEdit && (
            <button
              onClick={() => { setEditProduct(null); setShowForm(true); }}
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
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditProduct(null); }}
        />
      )}

      {/* Акордеон по постачальнику */}
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
                {/* Заголовок групи */}
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
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Товари */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-3">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                      {products.map((product) => (
                        <div key={product.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:shadow-sm transition">
                          {/* Фото */}
                          <div className="relative aspect-square bg-gray-100">
                            {product.photoPath ? (
                              <Image
                                src={product.photoPath}
                                alt={product.modelNumber}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-300">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Інфо */}
                          <div className="p-2">
                            <p className="font-mono text-xs font-semibold text-gray-800 truncate">{product.modelNumber}</p>
                            {product.price && (
                              <p className="text-xs font-medium text-green-700 mt-0.5">{product.price}</p>
                            )}
                            {product.note && (
                              <p className="text-xs text-gray-400 truncate mt-0.5">{product.note}</p>
                            )}

                            {(canEdit || canDelete) && (
                              <div className="flex gap-2 mt-2 pt-1.5 border-t border-gray-200">
                                {canEdit && (
                                  <button
                                    onClick={() => { setEditProduct(product); setShowForm(true); }}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    Ред.
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => handleDelete(product.id)}
                                    disabled={loading}
                                    className="text-xs text-red-500 hover:underline ml-auto"
                                  >
                                    Вид.
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">Всього товарів: {list.length} • Постачальників: {supplierNames.length}</p>
    </div>
  );
}


// ── Форма додавання/редагування ──────────────────────────────────────────────

function ProductForm({
  product,
  onSaved,
  onCancel,
}: {
  product: Product | null;
  onSaved: (p: Product) => void;
  onCancel: () => void;
}) {
  const [modelNumber, setModelNumber] = useState(product?.modelNumber ?? "");
  const [supplier, setSupplier] = useState(product?.supplier ?? "");
  const [price, setPrice] = useState(product?.price ?? "");
  const [note, setNote] = useState(product?.note ?? "");
  const [photoPath, setPhotoPath] = useState(product?.photoPath ?? "");
  const [previewUrl, setPreviewUrl] = useState(product?.photoPath ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePhoto(file: File) {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      console.log(`Стиснуто: ${formatFileSize(file.size)} → ${formatFileSize(compressed.size)}`);
      setPreviewUrl(URL.createObjectURL(compressed));
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPhotoPath(data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження фото");
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body = { modelNumber, supplier, price, note, photoPath: photoPath || null };

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

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Помилка збереження");
      return;
    }

    const saved = await res.json();
    onSaved(saved);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="font-semibold text-gray-800 mb-4">
        {product ? "Редагувати товар" : "Новий товар"}
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Фото */}
        <div className="md:row-span-3 flex flex-col items-center gap-3">
          <div
            className="relative w-48 h-48 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 transition overflow-hidden"
            onClick={() => document.getElementById("product-photo-input")?.click()}
          >
            {previewUrl ? (
              <Image src={previewUrl} alt="preview" fill className="object-cover" unoptimized />
            ) : (
              <div className="text-center text-gray-400 text-sm p-4">
                <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                Додати фото
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <span className="text-sm text-gray-500">Завантаження...</span>
              </div>
            )}
          </div>
          <input
            id="product-photo-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handlePhoto(e.target.files[0]); }}
          />
          <p className="text-xs text-gray-400">Клікніть щоб змінити фото</p>
        </div>

        {/* Поля */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Номер моделі <span className="text-red-500">*</span>
          </label>
          <input
            value={modelNumber}
            onChange={(e) => setModelNumber(e.target.value)}
            required
            placeholder="ABC-12345"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Постачальник</label>
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Назва постачальника"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ціна</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="150 ¥"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Нотатка</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Додаткова інформація"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {error && (
          <p className="md:col-span-2 text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="md:col-span-2 flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Скасувати
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </form>
    </div>
  );
}
