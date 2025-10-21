"use client";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";

type Analysis = {
  id: string;
  text: string;
  score: number;
  verdict: string;
  timestamp: string;
  details?: any;
};

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

  // Historique localStorage
  useEffect(() => {
    const raw = localStorage.getItem("ai_phishing_history");
    if (raw) setHistory(JSON.parse(raw));
  }, []);

  useEffect(() => {
    localStorage.setItem("ai_phishing_history", JSON.stringify(history));
  }, [history]);

  // Analyse texte
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

      if (!res.ok) throw new Error(`Erreur serveur: ${res.status}`);
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
      setHistory((h) => [entry, ...h].slice(0, 10));

      // Afficher popup si score élevé
      if (score >= 70) {
        setPopupMessage(`⚠️ Attention ! Message fortement suspect (${score}%)`);
        setShowPopup(true);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text("Historique AI Phishing Detector", 10, 10);
    let y = 20;

    history.forEach((item, idx) => {
      doc.text(`${idx + 1}. [${new Date(item.timestamp).toLocaleString()}] Score: ${item.score}% - ${item.verdict}`, 10, y);
      y += 10;
      doc.text(item.text.slice(0, 150) + (item.text.length > 150 ? "..." : ""), 12, y);
      y += 12;
      if (y > 280) { doc.addPage(); y = 10; }
    });

    doc.save("historique_phishing.pdf");
  };

  const getColor = (score: number) => {
    if (score >= 70) return { bg: "bg-red-50", bar: "bg-red-600", text: "text-red-800" };
    if (score >= 40) return { bg: "bg-yellow-50", bar: "bg-yellow-500", text: "text-yellow-800" };
    return { bg: "bg-green-50", bar: "bg-green-600", text: "text-green-800" };
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-8 bg-gray-50 text-gray-900">
      <div className="w-full max-w-3xl">
        <h1 className="text-4xl font-extrabold mb-6 text-gray-900">AI Phishing Detector</h1>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Colle ici un e-mail suspect..."
          className="w-full h-44 p-4 rounded-2xl border border-gray-300 shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-900"
        />

        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={analyzeText}
            disabled={loading || !text.trim()}
            className={`px-6 py-3 rounded-xl text-white font-semibold shadow-md transform transition 
              ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02]"}`}
          >
            {loading ? "Analyse en cours..." : "Analyser avec l'IA"}
          </button>

          <button
            onClick={() => { setText(""); setAnalysis(null); }}
            className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Effacer
          </button>

          <button
            onClick={exportPDF}
            className="px-4 py-2 rounded-xl border border-green-500 text-green-700 hover:bg-green-50"
          >
            Export PDF
          </button>

          <div className="ml-auto text-sm text-gray-500">Historique : {history.length}</div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-50 text-red-800 border border-red-100">
            Erreur: {error}
          </div>
        )}

        {analysis && (
          <div className={`mt-6 p-5 rounded-2xl shadow ${getColor(analysis.score).bg}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-bold ${getColor(analysis.score).text}`}>{analysis.verdict}</h2>
                <div className="text-sm text-gray-700 mt-1">Score : <span className="font-semibold">{analysis.score}%</span></div>
                <div className="text-xs text-gray-500 mt-1">Analysé le {new Date(analysis.timestamp).toLocaleString()}</div>
              </div>
              <div className="w-40">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div style={{ width: `${analysis.score}%` }} className={`h-3 rounded-full ${getColor(analysis.score).bar}`}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <section className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Historique récent</h3>
            <div className="space-y-3">
              {history.map(item => (
                <div key={item.id} className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="text-sm text-gray-900">{item.text.slice(0, 200)}{item.text.length>200?'...':''}</div>
                    <div className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</div>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-semibold">Score:</span> {item.score}% — <span className="italic">{item.verdict}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Popup stylé */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-200 animate-fadeIn">
            <h2 className="text-lg font-bold mb-2 text-gray-900">⚠️ Phishing détecté</h2>
            <p className="text-gray-700 mb-4">{popupMessage}</p>
            <button
              onClick={() => setShowPopup(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
