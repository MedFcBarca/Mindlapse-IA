"use client";

import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import jsPDF from "jspdf";

type Analysis = {
  id: string;
  text: string;
  score: number;
  verdict: string;
  timestamp: string;
  details?: any;
};

export default function DashboardPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("ai_phishing_history");
    if (raw) setHistory(JSON.parse(raw));
  }, []);

  useEffect(() => {
    localStorage.setItem("ai_phishing_history", JSON.stringify(history));
  }, [history]);

  const stats = useMemo(() => {
    const total = history.length;
    const phishing = history.filter((h) => h.score >= 70).length;
    const doubt = history.filter((h) => h.score >= 40 && h.score < 70).length;
    const safe = history.filter((h) => h.score < 40).length;
    const avgScore = total ? Math.round(history.reduce((s, h) => s + h.score, 0) / total) : 0;

    const map = new Map<string, { date: string; avg: number; count: number }>();
    history.slice(0, 50).reverse().forEach((h) => {
      const d = new Date(h.timestamp).toLocaleDateString();
      const cur = map.get(d) || { date: d, avg: 0, count: 0 };
      cur.avg = cur.avg * cur.count + h.score;
      cur.count += 1;
      cur.avg = cur.avg / cur.count;
      map.set(d, cur);
    });
    const chartData = Array.from(map.values()).slice(-14);
    return { total, phishing, doubt, safe, avgScore, chartData };
  }, [history]);

  const getColor = (score: number) => {
    if (score >= 75) return { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-600" };
    if (score >= 40) return { bg: "bg-yellow-50", text: "text-yellow-700", bar: "bg-yellow-500" };
    return { bg: "bg-green-50", text: "text-green-700", bar: "bg-green-600" };
  };

  const analyzeText = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch("http://localhost:3333/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Erreur serveur: ${res.status} ${body ? " - " + body.slice(0, 200) : ""}`);
      }

      const data = await res.json();
      const score = typeof data.score === "number" ? data.score : 0;
      const verdict = data.verdict || `Score: ${score}%`;

      const entry: Analysis = {
        id: String(Date.now()),
        text,
        score,
        verdict,
        timestamp: new Date().toISOString(),
        details: data.details || {}
      };

      setAnalysis(entry);
      setHistory((h) => [entry, ...h].slice(0, 200));  
      setText("");

      if (score >= 70) {
        setShowModal(true);
      } else {
        setToast(`Analyse terminée — Score ${score}%`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de l'analyse");
      setToast("Erreur lors de l'analyse");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Historique - AI Phishing Detector", 40, 50);
    doc.setFontSize(10);
    let y = 80;
    history.forEach((h, i) => {
      const date = new Date(h.timestamp).toLocaleString();
      const header = `${i + 1}. [${date}] Score: ${h.score}% — ${h.verdict}`;
      doc.text(header, 40, y);
      y += 16;
      const lines = doc.splitTextToSize(h.text, 500);
      doc.text(lines, 50, y);
      y += lines.length * 12 + 12;
      if (y > 720) { doc.addPage(); y = 40; }
    });
    doc.save("historique_phishing.pdf");
    setToast("PDF exporté");
    setTimeout(() => setToast(null), 2000);
  };

  const StatCard = ({ title, value, hint, accent }: { title: string; value: string | number; hint?: string; accent?: string }) => (
    <div className="bg-white rounded-2xl shadow p-4 w-full">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="flex items-center gap-3 mt-2">
        <div className="text-2xl font-bold">{value}</div>
        {hint && <div className="text-xs text-gray-400">{hint}</div>}
      </div>
      {accent && <div className="mt-3 text-xs text-gray-500">{accent}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r min-h-screen p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-yellow-400 rounded p-2 text-white font-bold">M</div>
            <div className="font-semibold">Mindlapse</div>
          </div>

          <nav className="space-y-2 text-sm">
            <button className="w-full text-left py-2 px-3 rounded-lg bg-gray-100">Dashboard</button>
            <button className="w-full text-left py-2 px-3 rounded-lg hover:bg-gray-100">Analyses</button>
            <button className="w-full text-left py-2 px-3 rounded-lg hover:bg-gray-100">Historique</button>
            <button className="w-full text-left py-2 px-3 rounded-lg hover:bg-gray-100">Paramètres</button>
          </nav>

          <div className="mt-8 text-xs text-gray-500">Compte</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200"></div>
            <div>
              <div className="text-sm font-medium">Mohamed A.</div>
              <div className="text-xs text-gray-400">mohamed_abbad@outlook.fr</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-8">
          {/* Header */}
          <header className="flex items-center justify-between mb-6">
            <div className="text-xl font-semibold">Dashboard</div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">Env: Dev</div>
              <div className="w-10 h-10 rounded-full bg-gray-200"></div>
            </div>
          </header>

          {/* Stats */}
          <section className="grid grid-cols-4 gap-4 mb-6">
            <StatCard title="Analyses total" value={stats.total} hint="Dernières 200" />
            <StatCard title="Taux phishing" value={`${stats.phishing || 0}`} hint="Messages >= 70%" />
            <StatCard title="Score moyen" value={`${stats.avgScore}/100`} hint="moyenne" />
            <StatCard title="Messages sûrs" value={stats.safe} hint="Score < 40%" />
          </section>

          {/* Chart + actions */}
          <section className="grid grid-cols-3 gap-6 mb-6">
            <div className="col-span-2 bg-white rounded-2xl p-5 shadow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Evolution du score moyen</h3>
                <div className="text-sm text-gray-500">Dernières dates</div>
              </div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData.length ? stats.chartData : [{ date: new Date().toLocaleDateString(), avg: stats.avgScore }]}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#fef3c7" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="avg" stroke="#f59e0b" fill="url(#colorScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Nouveau test</h3>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Colle un e-mail ici..."
                className="w-full h-36 p-3 rounded-lg border border-gray-200 resize-none focus:ring-2 focus:ring-blue-400"
              />

              <div className="mt-3 flex gap-3">
                <button
                  onClick={analyzeText}
                  disabled={loading || !text.trim()}
                  className={`px-4 py-2 rounded-lg text-white font-semibold ${loading ? "bg-blue-400" : "bg-gradient-to-r from-blue-600 to-indigo-600"}`}
                >
                  {loading ? "Analyse..." : "Analyser"}
                </button>
                <button onClick={() => { setText(""); setAnalysis(null); }} className="px-3 py-2 rounded-lg border">Effacer</button>
                <button onClick={exportPDF} className="px-3 py-2 rounded-lg border text-green-700">Export PDF</button>
              </div>

              {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
              {analysis && (
                <div className={`mt-4 p-3 rounded-lg ${getColor(analysis.score).bg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`font-semibold ${getColor(analysis.score).text}`}>{analysis.verdict}</div>
                      <div className="text-xs text-gray-600 mt-1">Score: {analysis.score}% • {new Date(analysis.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="w-28">
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div style={{ width: `${analysis.score}%` }} className={`h-3 rounded-full ${getColor(analysis.score).bar}`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Table */}
          <section className="bg-white rounded-2xl p-5 shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Historique récent</h3>
              <div className="text-sm text-gray-500">Total {stats.total}</div>
            </div>

            <div className="divide-y">
              {history.slice(0, 20).map((h) => (
                <div key={h.id} className="py-3 flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <div className="text-sm text-gray-800">{h.text.length > 140 ? h.text.slice(0, 140) + "..." : h.text}</div>
                    <div className="text-xs text-gray-400 mt-1">{new Date(h.timestamp).toLocaleString()}</div>
                  </div>

                  <div className="w-48 flex items-center justify-end gap-4">
                    <div className="text-sm w-20 text-right">{h.score}%</div>
                    <div className={`text-xs px-3 py-1 rounded-full ${h.score >= 70 ? "bg-red-100 text-red-700" : h.score >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                      {h.verdict}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Modal for high-risk */}
      {showModal && analysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold text-red-700">⚠️ Phishing détecté</h2>
              <button className="text-gray-400" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <p className="mt-3 text-gray-700">{analysis.verdict}</p>

            <div className="mt-4">
              <div className="text-sm text-gray-600">Extrait du message :</div>
              <div className="mt-2 p-3 bg-gray-50 rounded">{analysis.text}</div>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button className="px-4 py-2 rounded-lg border" onClick={() => { setShowModal(false); }}>Fermer</button>
              <button className="px-4 py-2 rounded-lg bg-red-600 text-white" onClick={() => { navigator.clipboard.writeText(analysis.text); setToast("Texte copié"); setTimeout(()=>setToast(null), 1800); }}>
                Copier le message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed right-6 bottom-6 bg-white shadow rounded-lg px-4 py-3 border">
          <div className="text-sm">{toast}</div>
        </div>
      )}
    </div>
  );
}
