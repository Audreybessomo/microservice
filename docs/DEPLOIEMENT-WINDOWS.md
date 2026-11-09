# Windows Server 2025 et client Windows 10

Cette configuration lance quatre conteneurs **Windows amd64 en isolation de processus**
sur Windows Server 2025 : les trois microservices Flask et le frontend. Le frontend
Windows utilise Flask/Waitress pour servir les fichiers et relayer les API à la place
du conteneur Nginx Linux. Le navigateur utilise toujours les mêmes URL `/api/...`.
Les données restent en mémoire : un redémarrage des services les réinitialise.

Le test Nano Server `CONTENEUR_OK` confirme que le serveur sait exécuter un conteneur.
Il ne valide pas encore la construction ou le fonctionnement de la boutique.

## 1. Préparer Windows Server

Dans PowerShell **administrateur**, vérifier le moteur Docker installé :

```powershell
& 'C:\Program Files\docker\docker.exe' version
```

Il faut obtenir les parties Client et Server avec `windows/amd64`.
Le chemin explicite évite le problème de `ProgramFiles` observé dans PowerShell 32 bits.

Installer le binaire autonome Docker Compose s'il manque (le moteur installé
manuellement ne l'inclut pas). Cette forme d'installation est documentée pour Windows
Server ; elle utilise la commande `docker-compose.exe` avec un tiret :

```powershell
Invoke-WebRequest -UseBasicParsing 'https://github.com/docker/compose/releases/download/v5.6.0/docker-compose-windows-x86_64.exe' -OutFile 'C:\Program Files\docker\docker-compose.exe'
& 'C:\Program Files\docker\docker-compose.exe' version
```

Source : https://docs.docker.com/compose/install/standalone/#on-windows-server

## 2. Copier le projet du Mac vers Windows

Copier **tout le dossier du projet mis à jour**, y compris les fichiers
`Dockerfile.windows`, `compose.windows.yml`, `frontend/server.py`, les fichiers
HTML/CSS/JS, les trois dossiers de services et `scripts`.
Par exemple, le placer dans `C:\projet-microservices` à l'aide d'un partage accessible
à la VM ou d'un transfert de fichiers. Les modifications faites sur le Mac ne mettent
pas automatiquement à jour la copie Windows.

## 3. Construire et lancer

```powershell
cd C:\projet-microservices
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Windows.ps1
```

L'option d'exécution ci-dessus s'applique uniquement à ce processus qui lance le
script local fourni dans le projet ; elle ne modifie pas la stratégie permanente.

L'image Python utilise **Windows Server Core**, plus volumineux que Nano Server.
Son premier téléchargement et sa première construction peuvent être longs dans UTM
sur un Mac Apple Silicon. Une seule image applicative est construite et partagée
par les quatre conteneurs, qui exécutent chacun leur service séparément.

Le script conserve le constructeur Docker classique pour les builds Windows et
s'arrête si une étape échoue. Il ne modifie ni le pare-feu ni le réseau de la VM.
L'image est `python:3.13-windowsservercore-ltsc2025`, une variante officielle Python
pour Windows Server 2025. Le fichier Compose Windows doit être utilisé **seul**,
sans le fusionner avec `docker-compose.yml`, qui décrit les conteneurs Linux.

Commandes équivalentes si vous préférez les exécuter à la main :

```powershell
cd C:\projet-microservices
$env:DOCKER_BUILDKIT = '0'
& 'C:\Program Files\docker\docker.exe' build --isolation=process -f Dockerfile.windows -t mini-boutique:windows .
# Continuer uniquement si la construction réussit.
& 'C:\Program Files\docker\docker-compose.exe' -f compose.windows.yml up -d --no-build
& 'C:\Program Files\docker\docker-compose.exe' -f compose.windows.yml ps
```

## 4. Vérifier les services

Attendre le démarrage, puis tester chaque API depuis Windows Server.
Utiliser **l'adresse IP du serveur** si `localhost` ne fonctionne pas avec le réseau
NAT Windows. Remplacer l'exemple par l'adresse réelle obtenue avec `ipconfig` :

```powershell
$baseUrl = 'http://192.168.64.3'
Invoke-RestMethod "$baseUrl/health"
Invoke-RestMethod "$baseUrl/api/users"
Invoke-RestMethod "$baseUrl/api/products"
Invoke-RestMethod "$baseUrl/api/orders"
```

L'état `Up` seul ne garantit pas que toutes les API répondent. Pour vérifier aussi
la communication du service commandes avec utilisateurs et produits, créer une
commande de démonstration (elle sera réellement ajoutée en mémoire) :

```powershell
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/orders" -ContentType 'application/json' -Body '{"user_id":1,"product_id":2,"quantite":3}'
```

La réponse doit contenir Audrey, Clavier, quantité 3 et total 45000. L'identifiant
dépend des commandes déjà créées.

## 5. Accéder depuis Windows 10

Windows 10 a seulement besoin d'un navigateur. Les API transitent par le frontend :
seul le port **80** est publié sur le serveur ; les ports 5001 à 5003 restent dans
le réseau Docker.

Dans PowerShell administrateur sur Windows Server, créer une règle pour HTTP si
aucune règle équivalente n'existe déjà :

```powershell
New-NetFirewallRule -DisplayName 'Mini-boutique HTTP' -Direction Inbound -Protocol TCP -LocalPort 80 -RemoteAddress LocalSubnet -Action Allow
```

Le client doit avoir une route vers l'adresse du serveur. Dans UTM, le réseau partagé
ne garantit pas l'accès depuis un autre ordinateur ou depuis une VM située sur un
réseau isolé différent. Si Windows 10 est aussi une VM UTM, vérifier qu'elle rejoint
le même réseau. Sinon, configurer un réseau en pont adapté à l'installation ou une
redirection de port. Ne pas modifier les adresses réseau sans vérifier la topologie.

Depuis Windows 10, remplacer l'exemple par l'adresse réelle du serveur :

```powershell
Test-NetConnection 192.168.64.3 -Port 80
```

Si `TcpTestSucceeded` est `True`, ouvrir `http://192.168.64.3` dans le navigateur,
choisir un produit et un client, puis passer une commande. Actualiser pour vérifier
son apparition dans l'historique.

## Journaux, arrêt et mise à jour

Depuis le dossier du projet dans Windows :

```powershell
& 'C:\Program Files\docker\docker-compose.exe' -f compose.windows.yml logs --tail 50
& 'C:\Program Files\docker\docker-compose.exe' -f compose.windows.yml down
```

Après une modification du code, recopier les fichiers modifiés sur Windows et
relancer `scripts/Start-Windows.ps1`. La reconstruction peut réutiliser les couches
déjà téléchargées. Un changement de code n'apparaît pas automatiquement dans un
conteneur existant.

En cas d'échec de téléchargement, garder le message d'erreur complet. Pour le moteur :

```powershell
Get-EventLog -LogName Application -Source Docker -Newest 10 | Format-List TimeGenerated, EntryType, Message
```
