"""Serveur du frontend et relais API pour les conteneurs Windows."""

import os
from pathlib import Path

import requests
from flask import Flask, Response, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=None)
SERVICES = {
    "users": os.environ.get("USERS_URL", "http://users-service:5001"),
    "products": os.environ.get("PRODUCTS_URL", "http://products-service:5002"),
    "orders": os.environ.get("ORDERS_URL", "http://orders-service:5003"),
}


@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/styles.css")
@app.get("/app.js")
def asset():
    return send_from_directory(ROOT, request.path.lstrip("/"))


@app.get("/health")
def health():
    return jsonify(status="ok", service="frontend")


@app.route("/api/<service>", methods=["GET", "POST"])
@app.get("/api/<service>/<int:item_id>")
def proxy(service, item_id=None):
    base_url = SERVICES.get(service)
    if base_url is None or (service == "orders" and item_id is not None):
        return jsonify(erreur="Route introuvable"), 404
    path = f"/api/{service}"
    if item_id is not None:
        path += f"/{item_id}"
    try:
        # Adresses fixes : aucun hôte ni en-tête fourni par le client n'est relayé.
        upstream = requests.request(
            request.method,
            base_url + path,
            params=request.args,
            data=request.get_data(),
            headers={"Content-Type": request.content_type} if request.content_type else {},
            timeout=(5, 15),
            allow_redirects=False,
        )
    except requests.Timeout:
        return jsonify(erreur="Le service met trop de temps à répondre"), 504
    except requests.RequestException:
        return jsonify(erreur="Le service est momentanément indisponible"), 503
    return Response(
        upstream.content,
        status=upstream.status_code,
        content_type=upstream.headers.get("Content-Type", "application/json"),
    )
