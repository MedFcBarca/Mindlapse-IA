
Pour lancer le front:
cd .\ai-phishing-detector\
cd .\frontend\
npm run dev

Pour lancer le back
cd .\ai-phishing-detector\
cd .\back
node server.js
oubliez pas de ajouter un .env pour mettre votre clé api de votre AI OPENAI_API_KEY=""






tests
1️⃣ Message sûr

Exemple :

Bonjour, peux-tu me confirmer notre réunion de mardi ? Merci.


score faible (0‑15%) 

Verdict attendu : Message probablement sûr.

2️⃣ Message douteux (quelques signes)

Exemple :

Bonjour, votre compte nécessite une vérification : http://bit.ly/xyz


 score moyen (40‑55%)

Verdict attendu : Douteux — vérifier les liens et l’expéditeur.

3️⃣ Message phishing probable

Exemple :

Votre compte bancaire sera suspendu ! Cliquez ici pour réactiver : http://fake-bank.com


score élevé (70‑100%) 
Verdict attendu : Phishing probable — éléments suspects détectés.

4️⃣ Message avec pièce jointe suspecte

Exemple :

Veuillez trouver la facture jointe pour vérification : invoice.exe


 score moyen à élevé (50‑70%) 

Verdict attendu : Douteux ou phishing probable selon combinaison.

