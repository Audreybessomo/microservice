from flask import Flask, jsonify, request

app = Flask(__name__)

# Données gardées en mémoire (pas de base de données)
users = [
    {"id": 1, "nom": "Audrey", "email": "audrey@exemple.cm"},
    {"id": 2, "nom": "Paul", "email": "paul@exemple.cm"},
]

@app.get("/health")
def health():
    return jsonify(status="ok", service="users-service")

@app.get("/api/users")
def list_users():
    return jsonify(users)

@app.get("/api/users/<int:user_id>")
def get_user(user_id):
    user = next((u for u in users if u["id"] == user_id), None)
    if user is None:
        return jsonify(erreur="Utilisateur introuvable"), 404
    return jsonify(user)

@app.post("/api/users")
def create_user():
    data = request.get_json() or {}
    if not data.get("nom"):
        return jsonify(erreur="Le champ 'nom' est obligatoire"), 400
    user = {"id": len(users) + 1, "nom": data["nom"], "email": data.get("email", "")}
    users.append(user)
    return jsonify(user), 201

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
