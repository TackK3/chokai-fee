import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { District, Member, Payment, MONTHS } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  district: District;
}

export function MemberTable({ district }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);

  const loadData = useCallback(async () => {
    const [m, p] = await Promise.all([
      invoke<Member[]>("get_members", { districtId: district.id }),
      invoke<Payment[]>("get_payments_for_district", { districtId: district.id }),
    ]);
    setMembers(m);
    setPayments(p);
  }, [district.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getPayment = (memberId: string, month: number): Payment | undefined => {
    return payments.find((p) => p.member_id === memberId && p.month === month);
  };

  const startEdit = (cellId: string, value: string) => {
    setEditingCell(cellId);
    setEditValue(value);
  };

  const handleMemberUpdate = async (member: Member, field: "address" | "name" | "monthly_fee") => {
    const address = field === "address" ? editValue : member.address;
    const name = field === "name" ? editValue : member.name;
    const monthlyFee = field === "monthly_fee" ? parseInt(editValue) || 0 : member.monthly_fee;
    await invoke("update_member", { id: member.id, address, name, monthlyFee });

    // 月額変更時、入力済みの月を新しい金額に更新
    if (field === "monthly_fee") {
      const memberPayments = payments.filter((p) => p.member_id === member.id && p.amount > 0);
      await Promise.all(
        memberPayments.map((p) =>
          invoke("upsert_payment", {
            memberId: member.id,
            month: p.month,
            amount: monthlyFee,
            paid: monthlyFee > 0,
          })
        )
      );
    }

    setEditingCell(null);
    loadData();
  };

  const handlePaymentUpdate = async (memberId: string, month: number) => {
    const amount = parseInt(editValue) || 0;
    await invoke("upsert_payment", {
      memberId,
      month,
      amount,
      paid: amount > 0,
    });
    setEditingCell(null);
    loadData();
  };

  const handleQuickPayment = async (member: Member, month: number) => {
    const existing = getPayment(member.id, month);
    if (existing && existing.amount > 0) {
      await invoke("upsert_payment", {
        memberId: member.id,
        month,
        amount: 0,
        paid: false,
      });
    } else {
      await invoke("upsert_payment", {
        memberId: member.id,
        month,
        amount: member.monthly_fee,
        paid: true,
      });
    }
    loadData();
  };

  const handleAddMember = async () => {
    await invoke("create_member", {
      districtId: district.id,
      address: "",
      name: "",
      monthlyFee: 0,
    });
    loadData();
  };

  const handleDeleteMember = (member: Member) => {
    setDeletingMember(member);
  };

  const confirmDeleteMember = async () => {
    if (!deletingMember) return;
    await invoke("delete_member", { id: deletingMember.id });
    setDeletingMember(null);
    loadData();
  };

  const handleBulkAction = async (member: Member, action: string) => {
    const id = member.id;
    if (action === "all") {
      await Promise.all(
        MONTHS.map((m) =>
          invoke("upsert_payment", {
            memberId: id,
            month: m.value,
            amount: member.monthly_fee,
            paid: member.monthly_fee > 0,
          })
        )
      );
    } else if (action === "half") {
      await Promise.all(
        MONTHS.map((m, i) =>
          invoke("upsert_payment", {
            memberId: id,
            month: m.value,
            amount: i < 6 ? member.monthly_fee : 0,
            paid: i < 6 && member.monthly_fee > 0,
          })
        )
      );
    } else if (action === "clear") {
      await Promise.all(
        MONTHS.map((m) =>
          invoke("upsert_payment", {
            memberId: id,
            month: m.value,
            amount: 0,
            paid: false,
          })
        )
      );
    }
    await loadData();
  };

  const getMemberTotal = (memberId: string): number => {
    return payments
      .filter((p) => p.member_id === memberId)
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const getMonthTotal = (month: number): number => {
    return payments
      .filter((p) => p.month === month)
      .reduce((sum, p) => sum + p.amount, 0);
  };

  const grandTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  const tableRef = useRef<HTMLTableElement>(null);

  const focusNextCell = (currentCellId: string, reverse = false) => {
    if (!tableRef.current) return;
    const cells = Array.from(
      tableRef.current.querySelectorAll<HTMLElement>("[data-cell-id]")
    );
    const currentIdx = cells.findIndex(
      (el) => el.dataset.cellId === currentCellId
    );
    if (currentIdx === -1) return;
    const nextIdx = reverse ? currentIdx - 1 : currentIdx + 1;
    if (nextIdx >= 0 && nextIdx < cells.length) {
      cells[nextIdx].focus();
    }
  };

  const renderEditableCell = (
    cellId: string,
    value: string,
    onSave: () => void,
    className = ""
  ) => {
    if (editingCell === cellId) {
      return (
        <input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave();
              setTimeout(() => focusNextCell(cellId), 50);
            }
            if (e.key === "Escape") setEditingCell(null);
            if (e.key === "Tab") {
              e.preventDefault();
              onSave();
              setTimeout(() => focusNextCell(cellId, e.shiftKey), 50);
            }
          }}
          className={`border-2 border-primary-500 rounded px-2 py-1 text-sm outline-none ${className}`}
          autoFocus
        />
      );
    }
    return (
      <span
        className="editable-cell"
        tabIndex={0}
        data-cell-id={cellId}
        onClick={() => startEdit(cellId, value)}
        onFocus={() => startEdit(cellId, value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startEdit(cellId, value);
          }
          if (e.key === "Tab") {
            e.preventDefault();
            focusNextCell(cellId, e.shiftKey);
          }
        }}
      >
        {value || "\u00A0"}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-r border-slate-200 w-10">
                  #
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 min-w-[80px]">
                  番地
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 min-w-[120px]">
                  氏名
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 min-w-[70px]">
                  月額
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m.value}
                    className="px-1 py-3 text-center text-xs font-semibold text-slate-500 border-b border-slate-200 min-w-[55px]"
                  >
                    {m.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 min-w-[80px]">
                  合計
                </th>
                <th className="px-2 py-3 border-b border-slate-200 w-16" />
              </tr>
            </thead>
            <tbody>
              {members.map((member, idx) => {
                const total = getMemberTotal(member.id);
                const isComplete = total >= member.monthly_fee && member.monthly_fee > 0;
                return (
                  <tr
                    key={member.id}
                    className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                      isComplete ? "bg-green-50/30" : ""
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-1 text-sm text-slate-400 border-r border-slate-100 text-center">
                      {idx + 1}
                    </td>
                    <td className="px-1 py-1">
                      {renderEditableCell(
                        `addr-${member.id}`,
                        member.address,
                        () => handleMemberUpdate(member, "address"),
                        "w-20"
                      )}
                    </td>
                    <td className="px-1 py-1">
                      {renderEditableCell(
                        `name-${member.id}`,
                        member.name,
                        () => handleMemberUpdate(member, "name"),
                        "w-28"
                      )}
                    </td>
                    <td className="px-1 py-1 text-right">
                      {renderEditableCell(
                        `fee-${member.id}`,
                        String(member.monthly_fee),
                        () => handleMemberUpdate(member, "monthly_fee"),
                        "w-16 text-right"
                      )}
                    </td>
                    {MONTHS.map((m) => {
                      const payment = getPayment(member.id, m.value);
                      const cellId = `pay-${member.id}-${m.value}`;
                      const amount = payment?.amount || 0;
                      return (
                        <td key={m.value} className="px-0 py-1">
                          {editingCell === cellId ? (
                            <div className="payment-cell">
                              <input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handlePaymentUpdate(member.id, m.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handlePaymentUpdate(member.id, m.value);
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <div
                              className={`payment-cell ${amount > 0 ? "paid" : "unpaid"}`}
                              onClick={() => handleQuickPayment(member, m.value)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                startEdit(cellId, String(amount));
                              }}
                              title="クリック: 一括入力 / ダブルクリック: 金額編集"
                            >
                              {amount > 0 ? amount.toLocaleString() : "―"}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-1 text-right">
                      <span
                        className={`text-sm font-semibold ${
                          isComplete ? "text-accent-600" : "text-slate-600"
                        }`}
                      >
                        {total > 0 ? `¥${total.toLocaleString()}` : ""}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1.5">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleBulkAction(member, e.target.value);
                              e.target.value = "";
                            }
                          }}
                          defaultValue=""
                          className="px-1 py-0.5 text-xs font-medium rounded bg-primary-50 text-primary-600 border border-primary-200 hover:bg-primary-100 hover:border-primary-300 transition-colors cursor-pointer outline-none"
                        >
                          <option value="" disabled>一括</option>
                          <option value="all">全月入力</option>
                          <option value="half">半年入力</option>
                          <option value="clear">全クリア</option>
                        </select>
                        <button
                          onClick={() => handleDeleteMember(member)}
                          className="px-2 py-0.5 text-xs font-medium rounded bg-slate-50 text-slate-400 border border-slate-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                          title="削除"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Total Row */}
              {members.length > 0 && (
                <tr className="bg-slate-50 font-semibold">
                  <td
                    colSpan={4}
                    className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-sm text-slate-600 text-right border-t-2 border-slate-200"
                  >
                    合計
                  </td>
                  {MONTHS.map((m) => (
                    <td
                      key={m.value}
                      className="px-1 py-2 text-center text-sm text-slate-600 border-t-2 border-slate-200"
                    >
                      {getMonthTotal(m.value) > 0
                        ? getMonthTotal(m.value).toLocaleString()
                        : ""}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right text-sm text-primary-700 border-t-2 border-slate-200">
                    ¥{grandTotal.toLocaleString()}
                  </td>
                  <td className="border-t-2 border-slate-200" />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add Member Button */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={handleAddMember}
            className="w-full py-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50/50 transition-all text-sm font-medium"
          >
            ＋ 会員を追加
          </button>
        </div>
      </div>

      {/* Summary */}
      {members.length > 0 && (
        <div className="mt-4 flex gap-4 text-sm text-slate-500">
          <span>会員数: {members.length}名</span>
          <span>
            年額合計: ¥{members.reduce((s, m) => s + m.monthly_fee * 12, 0).toLocaleString()}
          </span>
          <span>徴収済: ¥{grandTotal.toLocaleString()}</span>
          <span
            className={
              grandTotal >= members.reduce((s, m) => s + m.monthly_fee * 12, 0)
                ? "text-accent-600 font-semibold"
                : "text-orange-500"
            }
          >
            {members.reduce((s, m) => s + m.monthly_fee * 12, 0) > 0
              ? `進捗: ${Math.round(
                  (grandTotal / members.reduce((s, m) => s + m.monthly_fee * 12, 0)) * 100
                )}%`
              : ""}
          </span>
        </div>
      )}
      {deletingMember && (
        <ConfirmDialog
          message={`「${deletingMember.name || "名前未設定"}」を削除しますか？`}
          onConfirm={confirmDeleteMember}
          onCancel={() => setDeletingMember(null)}
        />
      )}
    </div>
  );
}
