"""Vérifie le relais Windows et le parcours de commande sans moteur Docker."""
import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import requests
import yaml

ROOT = Path(__file__).resolve().parents[1]


def load_module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


frontend = load_module('windows_frontend', 'frontend/server.py')
users = load_module('users_service', 'users-service/app.py')
products = load_module('products_service', 'products-service/app.py')
orders = load_module('orders_service', 'orders-service/app.py')


class WindowsFrontendTests(unittest.TestCase):
    def setUp(self):
        self.client = frontend.app.test_client()
        self.clients = {
            frontend.SERVICES['users']: users.app.test_client(),
            frontend.SERVICES['products']: products.app.test_client(),
            frontend.SERVICES['orders']: orders.app.test_client(),
        }
        orders.orders.clear()

    def relay(self, method, url, **kwargs):
        base, path = url.split('/api/', 1)
        response = self.clients[base].open(
            '/api/' + path, method=method, data=kwargs.get('data'),
            headers=kwargs.get('headers'), query_string=kwargs.get('params'),
        )
        return SimpleNamespace(content=response.data, status_code=response.status_code,
                               headers=dict(response.headers), json=response.get_json)

    def test_frontend_files_and_health(self):
        for path, content_type in [('/', 'text/html'), ('/styles.css', 'text/css'), ('/app.js', 'javascript')]:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertIn(content_type, response.content_type)
            self.assertTrue(response.data)
            response.close()
        self.assertEqual(self.client.get('/health').json['service'], 'frontend')

    def test_private_files_and_unknown_services_are_not_served(self):
        with patch.object(frontend.requests, 'request') as outbound:
            for path in ['/server.py', '/requirements-windows.txt', '/api/unknown', '/api/orders/1', '/api/users/../../server.py']:
                self.assertEqual(self.client.get(path).status_code, 404)
            outbound.assert_not_called()

    def test_lists_and_missing_resource_status(self):
        with patch.object(frontend.requests, 'request', side_effect=self.relay):
            self.assertEqual(self.client.get('/api/users').json[0]['nom'], 'Audrey')
            self.assertEqual(self.client.get('/api/products/2').json['prix'], 15000)
            self.assertEqual(self.client.get('/api/products/999').status_code, 404)

    def test_full_order_flow_through_frontend(self):
        def get_dependency(url, **kwargs):
            service = users if '/users/' in url else products
            path = '/api/' + url.split('/api/', 1)[1]
            response = service.app.test_client().get(path)
            return SimpleNamespace(status_code=response.status_code, json=response.get_json)

        with patch.object(frontend.requests, 'request', side_effect=self.relay), patch.object(orders.requests, 'get', side_effect=get_dependency):
            response = self.client.post('/api/orders', json={'user_id': 1, 'product_id': 2, 'quantite': 3})
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json['total'], 45000)
            self.assertEqual(response.json['client'], 'Audrey')
            self.assertEqual(self.client.get('/api/orders').json, [response.json])

    def test_timeout_and_connection_failure_return_json(self):
        for exception, status in [(requests.Timeout(), 504), (requests.ConnectionError(), 503)]:
            with self.subTest(status=status), patch.object(frontend.requests, 'request', side_effect=exception):
                response = self.client.get('/api/products')
                self.assertEqual(response.status_code, status)
                self.assertIn('erreur', response.json)

    def test_proxy_passes_payload_and_does_not_forward_browser_credentials(self):
        upstream = SimpleNamespace(content=b'{"id":3}', status_code=201, headers={'Content-Type': 'application/json'})
        with patch.object(frontend.requests, 'request', return_value=upstream) as outbound:
            response = self.client.post('/api/users', json={'nom': 'Test'}, headers={'Authorization': 'secret', 'Cookie': 'session=secret'})
            self.assertEqual(response.status_code, 201)
            args, kwargs = outbound.call_args
            self.assertEqual(args, ('POST', frontend.SERVICES['users'] + '/api/users'))
            self.assertEqual(kwargs['headers'], {'Content-Type': 'application/json'})
            self.assertFalse(kwargs['allow_redirects'])

    def test_windows_compose_services_share_image_and_only_publish_frontend(self):
        config = yaml.safe_load((ROOT / 'compose.windows.yml').read_text())
        self.assertEqual(set(config['services']), {'users-service', 'products-service', 'orders-service', 'frontend'})
        for name, service in config['services'].items():
            self.assertEqual(service['isolation'], 'process')
            self.assertEqual(service['image'], 'mini-boutique:windows')
            self.assertTrue(service['working_dir'].startswith('C:/app/'))
            if name != 'frontend':
                self.assertNotIn('ports', service)
        self.assertEqual(config['services']['frontend']['ports'], ['80:80'])
        self.assertEqual(config['networks']['backend']['driver'], 'nat')


if __name__ == '__main__':
    unittest.main()
