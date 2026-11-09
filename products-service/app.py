from flask import Flask, jsonify, request

app = Flask(__name__)

# Catalogue gardé en mémoire (prix en FCFA)
products = [
    {"id": 1, "nom": "Souris", "prix": 5000},
    {"id": 2, "nom": "Clavier", "prix": 15000},
    {"id": 3, "nom": "Écran", "prix": 85000},
]

@app.get("/health")
def health():
    return jsonify(status="ok", service="products-service")

@app.get("/api/products")
def list_products():
    return jsonify(products)

@app.get("/api/products/<int:product_id>")
def get_product(product_id):
    product = next((p for p in products if p["id"] == product_id), None)
    if product is None:
        return jsonify(erreur="Produit introuvable"), 404
    return jsonify(product)

@app.post("/api/products")
def create_product():
    data = request.get_json() or {}
    if not data.get("nom") or "prix" not in data:
        return jsonify(erreur="Les champs 'nom' et 'prix' sont obligatoires"), 400
    product = {"id": len(products) + 1, "nom": data["nom"], "prix": int(data["prix"])}
    products.append(product)
    return jsonify(product), 201

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002)
