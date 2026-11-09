# Mini-boutique – Architecture microservices sur Windows Server

Application client-serveur découpée en 3 microservices REST (Python Flask) + 1 page web (Nginx),
orchestrés avec Docker Compose.

| Service          | Port | Routes                                   |
|------------------|------|------------------------------------------|
| frontend         | 80   | `/` (page web) – relaie `/api/...`       |
| users-service    | 5001 | `GET/POST /api/users`, `GET /api/users/<id>` |
| products-service | 5002 | `GET/POST /api/products`, `GET /api/products/<id>` |
| orders-service   | 5003 | `GET/POST /api/orders` (appelle users + products) |

Chaque service a aussi `GET /health`.

## Lancer le projet

Sur une machine avec Docker capable d'exécuter des conteneurs Linux
(Linux, ou Docker Desktop sur un PC Windows compatible / Mac pour tester) :

```
docker compose up -d --build
docker compose ps
```

Puis ouvrir `http://localhost` (ou `http://192.168.10.10` depuis le client).

### Windows Server 2025 avec un client Windows 10

Une configuration native Windows est fournie : **[procédure complète](docs/DEPLOIEMENT-WINDOWS.md)**.
Elle utilise `Dockerfile.windows`, `compose.windows.yml` et le script
`scripts/Start-Windows.ps1`. Les quatre conteneurs Windows fonctionnent en isolation
de processus, sans WSL ni Docker Desktop. Le frontend Windows utilise Flask/Waitress
pour servir la même interface et relayer les API ; Nginx reste utilisé en mode Linux.

Copier le projet mis à jour sur Windows Server, installer Docker Compose selon la
procédure, puis lancer dans PowerShell administrateur :

```powershell
cd C:\projet-microservices
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Windows.ps1
```

Le fichier Compose Windows s'utilise seul. Seul le port 80 est publié, les trois
microservices restant accessibles par le frontend. Les données sont en mémoire.
La construction et les tests dans la VM Windows restent nécessaires pour valider le
déploiement complet ; le test Nano Server seul ne suffit pas.

## Tester depuis le client Windows (PowerShell)

```powershell
Invoke-RestMethod http://192.168.10.10/api/users
Invoke-RestMethod http://192.168.10.10/api/products
Invoke-RestMethod -Method Post -Uri http://192.168.10.10/api/orders -ContentType "application/json" -Body '{"user_id":1,"product_id":2,"quantite":3}'
Invoke-RestMethod http://192.168.10.10/api/orders
```

Remplacer `192.168.10.10` par l’adresse réelle du serveur. Réponse attendue pour une première commande :
`{"client":"Audrey","id":1,"produit":"Clavier","quantite":3,"total":45000}`

## Réseau et pare-feu Windows

Consulter la [procédure Windows](docs/DEPLOIEMENT-WINDOWS.md#5-accéder-depuis-windows-10)
pour l'accès client, la règle HTTP et les particularités du réseau UTM.

## Tester sans Docker (pour les développeurs)

```
pip install flask requests
python users-service/app.py      # terminal 1
python products-service/app.py   # terminal 2
python orders-service/app.py     # terminal 3
```
