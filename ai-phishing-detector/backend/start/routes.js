'use strict'

const Route = use('Route')
const axios = require('axios')

function normalizeText(s) {
  try {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  } catch (e) {
    return (s || '').toLowerCase()
  }
}

/**
 * Mock analyser (déterministe) — renvoie un résultat basé sur les mots-clés.
 * Utile pour le dev local sans clé OpenAI.
 */
function mockAnalyze(text) {
  const s = normalizeText(text)
  const hasUrl = /https?:\/\/[^\s]+/i.test(text)
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)

  const kw = {
    links: hasUrl ? 1 : 0,
    click: /(^|\s)(cliquer|cliquez|clique|cliquez ici|click)/i.test(s) ? 1 : 0,
    suspend: /suspendu|suspension|sera suspendu|compte suspendu|suspendre/i.test(s) ? 1 : 0,
    urgent: /urgent|immédiat|immédiatement|action requise/i.test(s) ? 1 : 0,
    login: /connectez-vous|se connecter|login|identifiant|mot de passe/i.test(s) ? 1 : 0,
    prize: /gagn(e|é)|prix|récompense|cadeau|winner|won/i.test(s) ? 1 : 0,
    attachment: /piece jointe|pièce jointe|attachment/i.test(s) ? 1 : 0
  }

  let score = 0
  if (kw.links) score += 40
  if (kw.click) score += 25
  if (kw.suspend) score += 30
  if (kw.urgent) score += 15
  if (kw.login) score += 12
  if (kw.attachment) score += 10
  if (kw.prize) score += 20
  if (hasEmail) score += 5

  if (score > 100) score = 100

  const verdict =
    score >= 70 ? `Phishing probable à ${score}% — éléments suspects détectés.` :
    score >= 40 ? `Douteux (${score}%) — vérifier les liens et l'expéditeur.` :
    `Message probablement sûr (${score}%).`

  return {
    score,
    verdict,
    message: verdict,
    details: { hasUrl, hasEmail, keywords: kw }
  }
}

Route.post('/analyze', async ({ request, response }) => {
  const text = request.input('text')
  console.log('[/analyze] Requête reçue — length:', text ? text.length : 0)

  if (!text || !text.trim()) {
    console.log('[/analyze] Texte vide — renvoi 400')
    return response.status(400).json({ error: 'Texte requis' })
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY
  console.log('[/analyze] OPENAI_KEY détectée:', OPENAI_KEY ? 'Oui' : 'Non')
console.log('[/analyze] OPENAI_KEY (TRUNC) =', OPENAI_KEY?.slice(0,6) + '...' || 'none')

  // Decide mode
 const useMock = !OPENAI_KEY || OPENAI_KEY.toUpperCase() === 'MOCK' || OPENAI_KEY.toUpperCase() === 'RANDOM'
 //const useMock = true;
  console.log('[/analyze] Mode:', useMock ? 'MOCK (pas d’appel réel à OpenAI)' : 'REAL (appel OpenAI)')

  try {
    if (useMock) {
      const result = mockAnalyze(text)
      console.log('[/analyze] MOCK result:', JSON.stringify(result))
      return response.json(result)
    }

    // --- REAL mode: appel OpenAI Chat Completions (gpt-3.5-turbo) ---
    // Construire le prompt / messages
    const systemPrompt = `Tu es un assistant qui détecte si un e-mail est du phishing. 
Réponds strictement en JSON avec les champs: score (nombre 0-100), verdict (court), explain (texte court), et details (objet optionnel).`
    const userPrompt = `Analyse ce message et renvoie un JSON. Message: ${text}`

    const payload = {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 300,
      temperature: 0
    }

    console.log('[/analyze] Envoi payload à OpenAI (sans clé affichée):', {
      model: payload.model,
      max_tokens: payload.max_tokens,
      temperature: payload.temperature
    })

    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    )

    console.log('[/analyze] OpenAI status:', resp.status)
    // Log part of the response for debugging (ne pas loger la clé)
    const raw = resp.data
    console.log('[/analyze] OpenAI raw response keys:', Object.keys(raw))

    // Extract assistant content
    const assistant = raw?.choices?.[0]?.message?.content || raw?.choices?.[0]?.text || ''
    console.log('[/analyze] Assistant text (truncated 500 chars):', assistant.slice(0, 500))

    // Try to parse JSON from assistant
    try {
      const parsed = JSON.parse(assistant)
      console.log('[/analyze] Parsed JSON from assistant:', parsed)
      // Normalize parsed fields
      const out = {
        score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 0,
        verdict: parsed.verdict || parsed.message || parsed.explain || 'Aucun verdict',
        message: parsed.message || parsed.verdict || parsed.explain || '',
        details: parsed.details || {}
      }
      console.log('[/analyze] Final output (from OpenAI parsed):', out)
      return response.json(out)
    } catch (e) {
      // If assistant didn't return valid JSON, fallback: try to infer score from text
      console.warn('[/analyze] Impossible de parser JSON depuis OpenAI. fallback -> renvoyer le texte brut.')
      // Simple fallback: look for percentage in the assistant text
      const m = (assistant || '').match(/(\d{1,3})\s*%/)
      const score = m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : 0
      const verdict = assistant || `Score estimé: ${score}%`
      const out = { score, verdict, message: verdict, details: { raw: assistant.slice(0, 500) } }
      console.log('[/analyze] Final output (fallback):', out)
      return response.json(out)
    }
  } catch (err) {
    // Log erreur pour debug
    console.error('[/analyze] ERREUR lors du traitement:', err?.message || err)
    if (err?.response?.data) {
      console.error('[/analyze] OpenAI response data:', JSON.stringify(err.response.data).slice(0, 2000))
    }
    return response.status(500).json({ error: 'Erreur lors de l\'analyse' })
  }
})
