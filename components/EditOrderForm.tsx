"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Order, OrderItem, Payment, ExtraExpense } from "@/lib/schema";
import { compressImage, formatFileSize } from "@/lib/compress";
import ProductAutocomplete from "@/components/ProductAutocomplete";

interface ColorQty {
  color: string;
  qty: number;
}

interface ItemDraft {
  localId: string;
  serverId?: string;
  photoPath: string;
  previewUrl: string;
  supplier: string;
  modelNumber: string;
  price: string;
  colors: ColorQty[];
  uploading: boolean;
  uploadError: string;
}

interface PaymentDraft {
  localId: string;
  serverId?: string;
  type: "CLIENT" | "SUPPLIER";
  amount: string;
  currency: "CNY" | "UAH";
  exchangeRate: string;
  photoPath: string;
  previewUrl: string;
  note: string;
  uploading: boolean;
  createdAt?: string;
}

interface ClientOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "WAITING_PAYMENT", label: "Очікуємо оплату клієнта" },
  { value: "CLIENT_PAID", label: "Клієнт оплатив" },
  { value: "ORDERED", label: "Замовили товар" },
  { value: "SENT_TO_CARGO", label: "Відправили на карго" },
];

const DELIVERY_OPTIONS = [
  { value: "", label: "— не обрано —" },
  { value: "AIR", label: "Авіа" },
  { value: "RAIL", label: "ЖД (залізниця)" },
];

function parseColors(colorsStr: string | null): ColorQty[] {
  if (!colorsStr) return [];
  try {
    const parsed = JSON.parse(colorsStr);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Old format: comma separated
    if (colorsStr.includes(",")) {
      return colorsStr.split(",").map(c => ({ color: c.trim(), qty: 1 }));
    }
    if (colorsStr.trim()) {
      return [{ color: colorsStr.trim(), qty: 1 }];
    }
  }
  return [];
}

export default function EditOrderForm({
  order,
  items: serverItems,
  payments: serverPayments,
  expenses: serverExpenses,
  clients,
}: {
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  expenses: ExtraExpense[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paymentFileInputRef = useRef<HTMLInputElement>(null);
  const cargoFileInputRef = useRef<HTMLInputElement>(null);

  const [clientId, setClientId] = useState(order.clientId ?? "");
  const [clientName, setClientName] = useState(order.clientName ?? "");
  const [note, setNote] = useState(order.note ?? "");
  const [status, setStatus] = useState(order.status as string);
  const [totalPrice, setTotalPrice] = useState(order.totalPrice ?? "");
  const [deliveryType, setDeliveryType] = useState(order.deliveryType ?? "");
  const [estimatedShipDate, setEstimatedShipDate] = useState(order.estimatedShipDate ?? "");
  const [orderDate, setOrderDate] = useState(order.orderDate ?? "");
  const [cargoPhotoPath, setCargoPhotoPath] = useState(order.cargoPhotoPath ?? "");
  const [cargoPhotoUploading, setCargoPhotoUploading] = useState(false);

  const [items, setItems] = useState<ItemDraft[]>(
    serverItems.map((si) => ({
      localId: si.id,
      serverId: si.id,
      photoPath: si.photoPath ?? "",
      previewUrl: si.photoPath ?? "",
      supplier: si.supplier ?? "",
      modelNumber: si.modelNumber ?? "",
      price: si.price ?? "",
      colors: parseColors(si.colors),
      uploading: false,
      uploadError: "",
    }))
  );

  const [paymentsState, setPaymentsState] = useState<PaymentDraft[]>(
    serverPayments.map((sp) => ({
      localId: sp.id,
      serverId: sp.id,
      type: sp.type as "CLIENT" | "SUPPLIER",
      amount: sp.amount ?? "",
      currency: (sp.currency ?? "CNY") as "CNY" | "UAH",
      exchangeRate: sp.exchangeRate ?? "",
      photoPath: sp.photoPath ?? "",
      previewUrl: sp.photoPath ?? "",
      note: sp.note ?? "",
      uploading: false,
      createdAt: sp.createdAt,
    }))
  );

  const [expensesState, setExpensesState] = useState<ExtraExpense[]>(serverExpenses ?? []);
  const [newExpenseDesc, setNewExpenseDesc] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [addingExpense, setAddingExpense] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activePaymentType, setActivePaymentType] = useState<"CLIENT" | "SUPPLIER">("CLIENT");

  // ── Item Upload ──
  async function handleItemFiles(files: FileList | null) {
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
      if (item?.previewUrl && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
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

  // ── Payment Upload ──
  async function handlePaymentFile(originalFile: File, type: "CLIENT" | "SUPPLIER") {
    const draft: PaymentDraft = {
      localId: crypto.randomUUID(),
      type,
      amount: "",
      currency: "CNY",
      exchangeRate: "",
      photoPath: "",
      previewUrl: URL.createObjectURL(originalFile),
      note: "",
      uploading: true,
    };

    setPaymentsState((prev) => [...prev, draft]);

    try {
      // Стискаємо фото перед завантаженням
      const compressedFile = await compressImage(originalFile);
      console.log(`Стиснуто: ${formatFileSize(originalFile.size)} → ${formatFileSize(compressedFile.size)}`);
      
      const fd = new FormData();
      fd.append("file", compressedFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Помилка завантаження");
      setPaymentsState((prev) =>
        prev.map((p) =>
          p.localId === draft.localId
            ? { ...p, photoPath: data.path, uploading: false }
            : p
        )
      );
    } catch {
      setPaymentsState((prev) => prev.filter((p) => p.localId !== draft.localId));
    }
  }

  function addPaymentWithoutPhoto(type: "CLIENT" | "SUPPLIER") {
    const draft: PaymentDraft = {
      localId: crypto.randomUUID(),
      type,
      amount: "",
      currency: "CNY",
      exchangeRate: "",
      photoPath: "",
      previewUrl: "",
      note: "",
      uploading: false,
    };
    setPaymentsState((prev) => [...prev, draft]);
  }

  function updatePayment(localId: string, field: keyof PaymentDraft, value: string) {
    setPaymentsState((prev) =>
      prev.map((p) => (p.localId === localId ? { ...p, [field]: value } : p))
    );
  }

  function removePayment(localId: string) {
    setPaymentsState((prev) => {
      const p = prev.find((x) => x.localId === localId);
      if (p?.previewUrl && p.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(p.previewUrl);
      }
      return prev.filter((x) => x.localId !== localId);
    });
  }

  // ── Cargo photo upload ──
  async function handleCargoPhotoUpload(originalFile: File) {
    setCargoPhotoUploading(true);
    try {
      // Стискаємо фото перед завантаженням
      const compressedFile = await compressImage(originalFile);
      console.log(`Стиснуто: ${formatFileSize(originalFile.size)} → ${formatFileSize(compressedFile.size)}`);
      
      const fd = new FormData();
      fd.append("file", compressedFile);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Помилка завантаження");
      setCargoPhotoPath(data.path);
    } catch (e) {
      console.error(e);
    }
    setCargoPhotoUploading(false);
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (items.some((it) => it.uploading) || paymentsState.some((p) => p.uploading)) {
      setError("Зачекайте, поки всі файли завантажаться");
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId || null,
        clientName: clientId ? clients.find((c) => c.id === clientId)?.name : clientName,
        note,
        status,
        totalPrice,
        deliveryType: deliveryType || null,
        estimatedShipDate: estimatedShipDate || null,
        orderDate: orderDate || null,
        cargoPhotoPath: cargoPhotoPath || null,
        items: items.map(({ photoPath, supplier, modelNumber, price, colors }) => ({
          photoPath,
          supplier,
          modelNumber,
          price,
          colors,
        })),
        payments: paymentsState.map(({ type, amount, currency, exchangeRate, photoPath, note, createdAt }) => ({
          type,
          amount,
          currency,
          exchangeRate: exchangeRate || null,
          photoPath,
          note,
          createdAt,
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
    handleItemFiles(e.dataTransfer.files);
  }

  // ── Payment calculations ──
  const total = parseFloat(totalPrice) || 0; // ¥

  // Клієнт: оплати в ¥ (CNY прямо, UAH ÷ курс)
  const clientPaidCNY = paymentsState
    .filter((p) => p.type === "CLIENT")
    .reduce((sum, p) => {
      const amt = parseFloat(p.amount) || 0;
      if (p.currency === "UAH") {
        const rate = parseFloat(p.exchangeRate) || 0;
        return sum + (rate > 0 ? amt / rate : 0);
      }
      return sum + amt;
    }, 0);

  // Клієнт: окремо сума в ₴ для відображення
  const clientPaidUAH = paymentsState
    .filter((p) => p.type === "CLIENT" && p.currency === "UAH")
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  // Постачальник — завжди ¥
  const wePaidCNY = paymentsState
    .filter((p) => p.type === "SUPPLIER")
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  // Додаткові витрати — в ¥
  const totalExpensesCNY = expensesState
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  // Борг клієнта = вартість замовлення − скільки заплатив у ¥
  const debtFromClient = total - clientPaidCNY;

  // Заробіток = надходження ¥ − витрати постачальнику ¥ − доп витрати ¥
  const profit = clientPaidCNY - wePaidCNY - totalExpensesCNY;

  // ── Auto-calculate total from items ──
  const calculatedTotal = items.reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    const totalQty = item.colors.reduce((q, c) => q + (c.qty || 0), 0) || 1; // якщо немає кольорів, вважаємо 1 шт
    return sum + (price * totalQty);
  }, 0);

  const clientPayments = paymentsState.filter((p) => p.type === "CLIENT");
  const supplierPayments = paymentsState.filter((p) => p.type === "SUPPLIER");

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
            <div className="flex gap-2">
              <input
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0.00"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-600 mb-1">Клієнт оплатив</p>
            <p className="text-xl font-bold text-green-700">{clientPaidCNY.toFixed(2)} ¥</p>
            {clientPaidUAH > 0 && (
              <p className="text-xs text-green-500">{clientPaidUAH.toFixed(0)} ₴</p>
            )}
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs text-orange-600 mb-1">Ми оплатили</p>
            <p className="text-xl font-bold text-orange-700">{wePaidCNY.toFixed(2)} ¥</p>
          </div>
        </div>

        {total > 0 && (
          <div className={`text-sm px-3 py-2 rounded-lg ${debtFromClient > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {debtFromClient > 0.001 ? `Борг клієнта: ${debtFromClient.toFixed(2)} ¥` : debtFromClient < -0.001 ? `Переплата: ${Math.abs(debtFromClient).toFixed(2)} ¥` : "Сплачено повністю"}
          </div>
        )}

        {/* Payment tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActivePaymentType("CLIENT")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activePaymentType === "CLIENT" ? "border-green-500 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Від клієнта ({clientPayments.length})
          </button>
          <button
            type="button"
            onClick={() => setActivePaymentType("SUPPLIER")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activePaymentType === "SUPPLIER" ? "border-orange-500 text-orange-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Постачальникам ({supplierPayments.length})
          </button>
        </div>

        {/* Payment list */}
        <div className="space-y-3">
          {(activePaymentType === "CLIENT" ? clientPayments : supplierPayments).map((p) => (
            <div key={p.localId} className="p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="flex gap-3">
                {p.previewUrl && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 shrink-0 relative">
                    <Image src={p.previewUrl} alt="чек" fill className="object-cover" unoptimized />
                  </div>
                )}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    value={p.amount}
                    onChange={(e) => updatePayment(p.localId, "amount", e.target.value)}
                    placeholder="Сума"
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <input
                    value={p.note}
                    onChange={(e) => updatePayment(p.localId, "note", e.target.value)}
                    placeholder="Примітка"
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePayment(p.localId)}
                  className="text-red-500 hover:text-red-700 text-sm px-2"
                >
                  ✕
                </button>
              </div>
              {/* Валюта — тільки для CLIENT */}
              {p.type === "CLIENT" && (
                <div className="flex items-center gap-3 pl-1">
                  <span className="text-xs text-gray-500">Валюта:</span>
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name={`currency-${p.localId}`}
                      value="CNY"
                      checked={p.currency === "CNY"}
                      onChange={() => updatePayment(p.localId, "currency", "CNY")}
                      className="accent-blue-600"
                    />
                    <span className="text-gray-700">¥ Юань</span>
                  </label>
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name={`currency-${p.localId}`}
                      value="UAH"
                      checked={p.currency === "UAH"}
                      onChange={() => updatePayment(p.localId, "currency", "UAH")}
                      className="accent-blue-600"
                    />
                    <span className="text-gray-700">₴ Гривня</span>
                  </label>
                  {p.currency === "UAH" && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">Курс:</span>
                      <input
                        value={p.exchangeRate}
                        onChange={(e) => updatePayment(p.localId, "exchangeRate", e.target.value)}
                        placeholder="4.2"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-xs text-gray-400">грн/¥</span>
                      {p.amount && p.exchangeRate && (
                        <span className="text-xs text-blue-600 ml-1">
                          = {(parseFloat(p.amount) / parseFloat(p.exchangeRate) || 0).toFixed(2)} ¥
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add payment buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              paymentFileInputRef.current?.click();
            }}
            className={`text-sm px-3 py-1.5 rounded-lg transition ${activePaymentType === "CLIENT" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-orange-100 text-orange-700 hover:bg-orange-200"}`}
          >
            + Додати з фото
          </button>
          <button
            type="button"
            onClick={() => addPaymentWithoutPhoto(activePaymentType)}
            className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            + Без фото
          </button>
          <input
            ref={paymentFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePaymentFile(file, activePaymentType);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* ── Додаткові витрати ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Додаткові витрати</h2>

        {/* Список витрат */}
        {expensesState.length > 0 ? (
          <div className="space-y-2">
            {expensesState.map((e) => (
              <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-800">{e.description}</span>
                  <span className="text-sm font-semibold text-orange-700">{e.amount} ¥</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/orders/${order.id}/expenses`, {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ expenseId: e.id }),
                    });
                    setExpensesState((prev) => prev.filter((x) => x.id !== e.id));
                  }}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="text-sm font-semibold text-orange-700 text-right pt-1">
              Всього витрат: {totalExpensesCNY.toFixed(2)} ¥
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Додаткових витрат немає</p>
        )}

        {/* Форма додавання */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Назва витрати</label>
            <input
              value={newExpenseDesc}
              onChange={(e) => setNewExpenseDesc(e.target.value)}
              placeholder="Доставка, митниця, упаковка..."
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-gray-500 mb-1">Сума (¥)</label>
            <input
              value={newExpenseAmount}
              onChange={(e) => setNewExpenseAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            type="button"
            disabled={addingExpense || !newExpenseDesc.trim() || !newExpenseAmount.trim()}
            onClick={async () => {
              setAddingExpense(true);
              const res = await fetch(`/api/orders/${order.id}/expenses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: newExpenseDesc, amount: newExpenseAmount }),
              });
              if (res.ok) {
                const created = await res.json();
                setExpensesState((prev) => [...prev, created]);
                setNewExpenseDesc("");
                setNewExpenseAmount("");
              }
              setAddingExpense(false);
            }}
            className="px-3 py-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            + Додати
          </button>
        </div>
      </div>

      {/* ── Фінансовий підсумок ── */}
      <div className="bg-white rounded-xl border border-blue-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Фінансовий підсумок</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-blue-500 mb-1">Вартість замовлення</p>
            <p className="text-2xl font-bold text-blue-700">{total.toFixed(2)} ¥</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-xs text-green-500 mb-1">Надходження від клієнта</p>
            <p className="text-2xl font-bold text-green-700">{clientPaidCNY.toFixed(2)} ¥</p>
            {clientPaidUAH > 0 && (
              <p className="text-xs text-green-500 mt-0.5">{clientPaidUAH.toFixed(0)} ₴</p>
            )}
          </div>
          <div className="bg-orange-50 rounded-xl p-4">
            <p className="text-xs text-orange-500 mb-1">Витрати</p>
            <p className="text-2xl font-bold text-orange-700">{wePaidCNY.toFixed(2)} ¥</p>
            {totalExpensesCNY > 0 && (
              <p className="text-xs text-orange-400 mt-0.5">+ {totalExpensesCNY.toFixed(2)} ¥ доп.</p>
            )}
          </div>
          <div className={`rounded-xl p-4 ${profit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
            <p className={`text-xs mb-1 ${profit >= 0 ? "text-emerald-500" : "text-red-500"}`}>Заробіток</p>
            <p className={`text-2xl font-bold ${profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {profit >= 0 ? "+" : ""}{profit.toFixed(2)} ¥
            </p>
          </div>
        </div>
        {debtFromClient > 0.001 && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">
            Борг клієнта: {debtFromClient.toFixed(2)} ¥
          </div>
        )}
        {debtFromClient < -0.001 && (
          <div className="bg-green-50 text-green-700 text-sm px-4 py-2 rounded-lg">
            Переплата клієнта: {Math.abs(debtFromClient).toFixed(2)} ¥
          </div>
        )}
      </div>

      {/* ── Клієнт + статус + примітка ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Інформація</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Клієнт</label>
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
            {!clientId && (
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ім'я клієнта"
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип доставки</label>
            <select
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {DELIVERY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата замовлення</label>
            <input
              type="text"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              placeholder="ДД.ММ"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Орієнтовна дата відправки</label>
            <input
              type="text"
              value={estimatedShipDate}
              onChange={(e) => setEstimatedShipDate(e.target.value)}
              placeholder="ДД.ММ"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Примітка</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
          />
        </div>

        {/* Фото карго */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Фото відправки на карго</label>
          <div className="flex items-center gap-3">
            {cargoPhotoPath ? (
              <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
                <Image src={cargoPhotoPath} alt="Карго" fill className="object-cover" unoptimized />
                <button
                  type="button"
                  onClick={() => setCargoPhotoPath("")}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => cargoFileInputRef.current?.click()}
                disabled={cargoPhotoUploading}
                className="w-24 h-24 border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-purple-500 transition"
              >
                {cargoPhotoUploading ? (
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="text-2xl">📦</span>
                    <span className="text-xs mt-1">Додати</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={cargoFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCargoPhotoUpload(file);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-gray-400">Фото підтверджує відправку товару на карго</p>
          </div>
        </div>
      </div>

      {/* ── Товари ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Товари</h2>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition mb-6"
        >
          <p className="text-sm text-gray-600">Натисніть або перетягніть фото</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleItemFiles(e.target.files)}
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
          {saving ? "Збереження..." : "Зберегти"}
        </button>
      </div>
    </form>
  );
}
