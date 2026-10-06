import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface ProductRow { id: string; name: string; category: string; price: number; unit: string; hpp: number; margin: number }
interface IngredientRow { id: string; name: string; unit: string; price: number; stock: number; min_stock: number; supplier: string }
interface Sales { total: number; daily: { date: string; revenue: number }[]; byProduct: { id: string; name: string; qty: number; revenue: number }[] }

const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');
const fmtNum = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });

export default function DataPanel() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [ings, setIngs] = useState<IngredientRow[]>([]);
  const [sales, setSales] = useState<Sales | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.data<ProductRow[]>('products'), api.data<IngredientRow[]>('ingredients'), api.data<Sales>('sales')])
      .then(([p, i, s]) => {
        setProducts(p);
        setIngs(i);
        setSales(s);
      })
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="p-4 text-sm text-red-600">Gagal memuat data: {err}</p>;
  if (!sales) return <p className="p-4 text-sm text-crust-400">Memuat data bakery…</p>;

  const max = Math.max(...sales.daily.map((d) => d.revenue), 1);
  const low = ings.filter((i) => i.stock < i.min_stock);
  const h = hover !== null ? sales.daily[hover] : null;

  return (
    <div className="scroll-thin h-full space-y-4 overflow-y-auto p-3 text-sm">
      <section>
        <h3 className="font-pixel text-[9px] text-crust-600 dark:text-peach-300">OMZET 30 HARI</h3>
        <p className="mt-1 text-xl font-bold">{rp(sales.total)}</p>
        <p className="text-xs text-crust-400">
          {h ? `${h.date}: ${rp(h.revenue)}` : `Rata-rata ${rp(sales.total / Math.max(sales.daily.length, 1))}/hari · arahkan kursor ke batang`}
        </p>
        <div className="mt-2 flex h-20 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {sales.daily.map((d, i) => (
            <div
              key={d.date}
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover(i)}
              className={`flex-1 rounded-t-sm ${hover === i ? 'bg-crust-600' : 'bg-crust-300 dark:bg-crust-500'}`}
              style={{ height: `${(d.revenue / max) * 100}%` }}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 font-pixel text-[9px] text-crust-600 dark:text-peach-300">PRODUK · HPP BAHAN · MARGIN</h3>
        <div className="overflow-x-auto rounded-lg border border-crust-600/15">
          <table className="w-full text-xs">
            <thead className="bg-peach-100/60 dark:bg-night-700 text-left">
              <tr><th className="p-1.5">Produk</th><th className="p-1.5 text-right">Harga</th><th className="p-1.5 text-right">HPP</th><th className="p-1.5 text-right">Margin</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-crust-600/10">
                  <td className="p-1.5"><div className="font-medium">{p.name}</div><div className="text-[10px] text-crust-400">{p.category} · {p.unit}</div></td>
                  <td className="p-1.5 text-right tabular-nums">{rp(p.price)}</td>
                  <td className="p-1.5 text-right tabular-nums">{rp(p.hpp)}</td>
                  <td className={`p-1.5 text-right tabular-nums font-semibold ${p.margin < 0.5 ? 'text-crust-500' : 'text-mint-500'}`}>{(p.margin * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[10px] text-crust-400">HPP di sini = biaya bahan & kemasan (belum termasuk overhead).</p>
      </section>

      <section>
        <h3 className="mb-1.5 font-pixel text-[9px] text-crust-600 dark:text-peach-300">STOK GUDANG {low.length > 0 && <span className="text-red-500">· {low.length} DI BAWAH MIN</span>}</h3>
        <ul className="space-y-1">
          {ings.map((i) => {
            const ratio = Math.min(1, i.stock / Math.max(i.min_stock * 2, 1));
            const isLow = i.stock < i.min_stock;
            return (
              <li key={i.id} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className={isLow ? 'font-semibold text-red-600 dark:text-red-400' : ''}>{isLow ? '⚠️ ' : ''}{i.name}</span>
                  <span className="shrink-0 tabular-nums text-crust-400">{fmtNum(i.stock)} / min {fmtNum(i.min_stock)} {i.unit}</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-cream-300/60 dark:bg-night-700">
                  <div className={`h-full rounded-full ${isLow ? 'bg-red-400' : 'bg-mint-400'}`} style={{ width: `${ratio * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
