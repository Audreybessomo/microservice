import os
import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

# Adresses des autres microservices (noms Docker, définis dans docker-compose.yml)
USERS_URL = os.environ.get("USERS_URL", "http://localhost:5001")
PRODUCTS_URL = os.environ.get("PRODUCTS_URL", "http://localhost:5002")

orders = []

@app.get("/health")
def health():
    return jsonify(status="ok", service="orders-service")

@app.get("/api/orders")
def list_orders():
    return jsonify(orders)

@app.post("/api/orders")
def create_order():
    data = request.get_json() or {}
    try:
        user_id = int(data["user_id"])
        product_id = int(data["product_id"])
        quantite = int(data.get("quantite", 1))
    except (KeyError, ValueError):
        return jsonify(erreur="Champs attendus : user_id, product_id, quantite"), 400

    # Communication entre microservices : on interroge les deux autres services
    try:
        u = requests.get(f"{USERS_URL}/api/users/{user_id}", timeout=5)
        p = requests.get(f"{PRODUCTS_URL}/api/products/{product_id}", timeout=5)
    except requests.RequestException:
        return jsonify(erreur="Un service (users ou products) est injoignable"), 503
    if u.status_code != 200:
        return jsonify(erreur="Utilisateur introuvable"), 404
    if p.status_code != 200:
        return jsonify(erreur="Produit introuvable"), 404

    user, product = u.json(), p.json()
    order = {
        "id": len(orders) + 1,
        "client": user["nom"],
        "produit": product["nom"],
        "quantite": quantite,
        "total": product["prix"] * quantite,
    }
    orders.append(order)
    return jsonify(order), 201

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5003)
