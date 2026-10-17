// Formatação em pt-BR e utilidades pequenas usadas em todas as telas.
import { ALL, LOWER } from "./constants.js";

export const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function fmt(v, unit) {
  if (v == null || Number.isNaN(v)) return "—";
  if (unit === "brl") return brl.format(v);
  if (unit === "pct") return `${nf.format(v)}%`;
  if (unit === "x") return `${nf.format(v)}×`;
  if (unit === "min") return v < 1 ? `${Math.round(v * 60)} s` : v < 60 ? `${nf.format(v)} min` : ((r) => `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, "0")} min`)(Math.round(v));
  return nf.format(v);
}

export const when = (s) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—");
export const timeOnly = (s) => (s ? new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "");
export const dayKey = (s) => new Date(new Date(s).getTime() - 3 * 3600000).toISOString().slice(0, 10); // dia de Brasília

// "há 5 min", "há 3 h", "há 2 dias"
export function ago(s) {
  if (!s) return "";
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  if (m < 1440) return `há ${Math.round(m / 60)} h`;
  const d = Math.round(m / 1440);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

export const metricBy = (id) => ALL.find((x) => x.id === id);

// Variação contra o mesmo período anterior: % para contagem e dinheiro, pontos percentuais para taxa.
// good = a variação é boa para essa métrica (custo subindo é ruim).
export function delta(metric, unit, id) {
  if (!metric || metric.value == null || metric.previous == null) return null;
  const diff = metric.value - metric.previous;
  const good = diff === 0 ? null : (diff > 0) !== LOWER.has(id);
  const text = unit === "pct" ? `${nf.format(Math.abs(diff))} p.p.` : metric.previous ? `${nf.format(Math.abs((diff / Math.abs(metric.previous)) * 100))}%` : fmt(Math.abs(diff), unit);
  return { up: diff > 0, zero: diff === 0, good, text };
}

export const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: segue sem lembrar */ } },
};

// Exporta linhas como CSV (separador ";" para abrir direto no Excel em pt-BR).
export function downloadCsv(name, head, rows) {
  const cell = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const initials = (name) => (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

// Rótulo de cada intervalo do período (o gráfico mostra a data de início do intervalo).
export function bucketLabels(period, buckets, n) {
  const [, days] = buckets[period], step = days * 86400000, start = Date.now() - n * step;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start + i * step);
    return days < 1 ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", timeZone: "America/Sao_Paulo" }) + " h" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  });
}
