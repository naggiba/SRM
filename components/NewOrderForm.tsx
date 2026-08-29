"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { compressImage, formatFileSize } from "@/lib/compress";
import ProductAutocomplete from "@/components/ProductAutocomplete";

interface ColorQty {
  color: string;
  qty: number;
}

interface ItemDraft {
  localId: string;
  photoPath: string;
  previewUrl: string;
  supplier: string;
  modelNumber: string;
  price: string;
  colors: ColorQty[];
  uploading: boolean;
  uploadError: string;
}

interface ClientOption {
  id: string;
  name: string;
}

export default function NewOrderForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [note, setNote] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [clientPaid, setClientPaid] = useState("");
  const [wePaid, setWePaid] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Upload ──
  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const newItems: ItemDraft[] = Array.from(files).map((f) => ({
      localId: crypto.randomUUID(),
      photoPath: "",
      previewUrl: URL.createObjectURL(f),
      supplier: "",
      modelNumber: "",
      price: "",
      colors: [],
      uploading: true,
      uploadError: "",
    }));

    setItems((prev) => [...prev, ...newItems]);

    await Promise.all(
      newItems.map(async (draft, idx) => {
        const originalFile = files[idx];
        try {
          // Стискаємо фото перед завантаженням
          const compressedFile = await compressImage(originalFile);
          console.log(`Стиснуто: ${formatFileSize(originalFile.size)} → ${formatFileSize(compressedFile.size)}`);
          
          const fd = new FormData();
          fd.append("file", compressedFile);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Помилка завантаження");
          setItems((prev) =>
            prev.map((it) =>
              it.localId === draft.localId
                ? { ...it, photoPath: data.path, uploading: false }
                : it
            )
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Помилка";
          setItems((prev) =>
            prev.map((it) =>
              it.localId === draft.localId
                ? { ...it, uploading: false, uploadError: msg }
                : it
            )
          );
        }
      })
    );
  }

  function updateItem(localId: string, field: keyof ItemDraft, value: string | ColorQty[]) {
    setItems((prev) =>
      prev.map((it) => (it.localId === localId ? { ...it, [field]: value } : it))
    );
  }

  function removeItem(localId: string) {
    setItems((prev) => {
      const item = prev.find((it) => it.localId === localId);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((it) => it.localId !== localId);
    });
  }

  // ── Colors ──
  function addColor(localId: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.localId === localId
          ? { ...it, colors: [...it.colors, { color: "", qty: 1 }] }
          : it
      )
    );
  }

  function updateColor(localId: string, idx: number, field: "color" | "qty", value: string | number) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.localId !== localId) return it;
        const newColors = [...it.colors];
        newColors[idx] = { ...newColors[idx], [field]: value };
        return { ...it, colors: newColors };
      })
    );
  }

  function removeColor(localId: string, idx: number) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.localId !== localId) return it;
        const newColors = it.colors.filter((_, i) => i !== idx);
        return { ...it, colors: newColors };
      })
    );
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (items.some((it) => it.uploading)) {
      setError("Зачекайте, поки всі фото завантажаться");
      return;
    }
    if (items.some((it) => it.uploadError)) {
      setError("Деякі фото не завантажились. Видаліть їх або повторіть спробу.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId || null,
        clientName: clientId ? clients.find((c) => c.id === clientId)?.name : clientName,
        note,
        totalPrice,
        clientPaid,
        wePaid,
        items: items.map(({ photoPath, supplier, modelNumber, price, colors }) => ({
          photoPath,
          supplier,
          modelNumber,
          price,
          colors,
        })),
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Помилка збереження");
      return;
    }

    // Зберігаємо товари в каталог (ігноруємо помилки)
    await Promise.allSettled(
      items
        .filter((it) => it.modelNumber.trim())
        .map((it) =>
          fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modelNumber: it.modelNumber,
              supplier: it.supplier,
              price: it.price,
              photoPath: it.photoPath || null,
            }),
          })
        )
    );

    router.push("/orders");
    router.refresh();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  // ── Payment calculations ──
  const total = parseFloat(totalPrice) || 0;
  const paid = parseFloat(clientPaid) || 0;
  const wePaidNum = parseFloat(wePaid) || 0;
  const debtFromClient = total - paid;
  const debtToSupplier = total - wePaidNum;

  // ── Auto-calculate total from items ──
  const calculatedTotal = items.reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    const totalQty = item.colors.reduce((q, c) => q + (c.qty || 0), 0) || 1;
    return sum + (price * totalQty);
  }, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Оплата ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Оплата</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Загальна вартість
            </label>
            <input
              value={totalPrice}
              onChange={(e) => setTotalPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {calculatedTotal > 0 && calculatedTotal !== total && (
              <button
                type="button"
                onClick={() => setTotalPrice(calculatedTotal.toFixed(2))}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
              >
                Застосувати розрахунок: {calculatedTotal.toFixed(2)}
              </button>
            )}
            {calculatedTotal > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Авто: {calculatedTotal.toFixed(2)} (ціна × кількість)
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Оплатив клієнт
            </label>
            <input
              value={clientPaid}
              onChange={(e) => setClientPaid(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ми оплатили постачальникам
            </label>
            <input
              value={wePaid}
              onChange={(e) => setWePaid(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {total > 0 && (
          <div className="flex flex-wrap gap-4 mt-2">
            <div className={`text-sm px-3 py-1.5 rounded-lg ${debtFromClient > 0 ? "bg-yellow-50 text-yellow-700" : debtFromClient < 0 ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"}`}>
              Борг клієнта: <span className="font-semibold">{debtFromClient.toFixed(2)}</span>
            </div>
            <div className={`text-sm px-3 py-1.5 rounded-lg ${debtToSupplier > 0 ? "bg-yellow-50 text-yellow-700" : debtToSupplier < 0 ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"}`}>
              Борг постачальникам: <span className="font-semibold">{debtToSupplier.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Клієнт + примітка ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Інформація про замовлення</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Клієнт</label>
            {clients.length > 0 ? (
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— оберіть або введіть вручну —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : null}
            {!clientId && (
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ім'я клієнта (вручну)"
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Примітка</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Будь-яка додаткова інформація..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* ── Товари ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Товари (фото + деталі)</h2>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition mb-6"
        >
          <p className="text-sm text-gray-600">Натисніть або перетягніть фото сюди</p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — до 10 МБ кожне</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {items.length > 0 && (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.localId} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-500">Товар #{idx + 1}</span>
                  {item.uploading && <span className="text-xs text-blue-500">завантаження...</span>}
                  {item.uploadError && <span className="text-xs text-red-500">{item.uploadError}</span>}
                  <button type="button" onClick={() => removeItem(item.localId)} className="ml-auto text-xs text-red-500 hover:underline">
                    Видалити
                  </button>
                </div>

                <div className="flex flex-col md:flex-row">
                  <div className="md:w-40 h-40 shrink-0 bg-gray-100 relative">
                    {item.previewUrl ? (
                      <Image src={item.previewUrl} alt={`Товар ${idx + 1}`} fill className="object-cover" unoptimized />
                    ) : (
                      <span className="flex items-center justify-center h-full text-gray-400">Немає фото</span>
                    )}
                    {item.uploading && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-4 space-y-3">
                    <ProductAutocomplete
                      modelNumber={item.modelNumber}
                      supplier={item.supplier}
                      price={item.price}
                      onSelect={(data) => {
                        updateItem(item.localId, "modelNumber", data.modelNumber);
                        updateItem(item.localId, "supplier", data.supplier);
                        updateItem(item.localId, "price", data.price);
                      }}
                      onChange={(field, value) => updateItem(item.localId, field, value)}
                    />

                    {/* Colors with quantity */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-600">Кольори та кількість:</span>
                        <button
                          type="button"
                          onClick={() => addColor(item.localId)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          + Додати колір
                        </button>
                      </div>
                      {item.colors.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.colors.map((c, ci) => (
                            <div key={ci} className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                              <input
                                value={c.color}
                                onChange={(e) => updateColor(item.localId, ci, "color", e.target.value)}
                                placeholder="Колір"
                                className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-xs"
                              />
                              <span className="text-gray-400 text-xs">×</span>
                              <input
                                type="number"
                                value={c.qty}
                                onChange={(e) => updateColor(item.localId, ci, "qty", parseInt(e.target.value) || 0)}
                                className="w-12 px-1.5 py-0.5 border border-gray-300 rounded text-xs text-center"
                                min="0"
                              />
                              <button
                                type="button"
                                onClick={() => removeColor(item.localId, ci)}
                                className="text-red-400 hover:text-red-600 text-xs ml-1"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

      <div className="flex gap-3 justify-end">
        <a href="/orders" className="px-5 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition">
          Скасувати
        </a>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
        >
          {saving ? "Збереження..." : "Зберегти замовлення"}
        </button>
      </div>
    </form>
  );
}
