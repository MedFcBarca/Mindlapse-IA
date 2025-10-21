'use strict'

module.exports = {
  // Autorise ton frontend ou tous les domaines pendant dev
  origin: ['http://localhost:3000'], // ou origin: true pour autoriser tous

  // Méthodes HTTP autorisées
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],

  // Headers autorisés
  headers: true, // true = accepte tous les headers envoyés

  // Headers exposés au frontend
  exposeHeaders: true, // si tu veux accéder aux headers depuis le frontend

  // Pas besoin de credentials pour notre cas
  credentials: false,

  // Cache du préflight CORS
  maxAge: 90
}
