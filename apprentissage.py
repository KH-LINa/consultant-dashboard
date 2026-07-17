# Fichier d'apprentissage Python
nom = "Khelaf"
age = 45
print("Bonjour, je m'appelle", nom)
print("Type de la variable nom :", type(nom))
print("Type de la variable age :", type(age))

donnees = {"nom": "Khelaf", "age": 45}
print("Type de la variable donnees :", type(donnees))

reponse_api = {
    "id": "msg_123",
    "modele": "claude-sonnet-4-6",
    "tokens_utilises": 150,
    "contenu": "Voici ma réponse..."
}

print(reponse_api["modele"])
print(reponse_api["tokens_utilises"])

messages = ["Analyse ce contrat", "Résume ce document", "Traduis ce texte"]
print(messages[0])
print(messages[2])
print(messages[1])

messages = ["Analyse ce contrat", "Résume ce document", "Traduis ce texte"]

for message in messages:
    print("Traitement :", message)
    resultats = [
    {"client": "Usine Brandt", "tache": "Analyse contrat", "tokens": 120},
    {"client": "PME Lyon", "tache": "Résumé document", "tokens": 85},
    {"client": "ETI Bordeaux", "tache": "Traduction", "tokens": 200},
]

for resultat in resultats:
    print(resultat["client"], "-", resultat["tache"])