import logging
logging.disable(logging.CRITICAL)
import warnings
warnings.filterwarnings("ignore")

from fastapi.testclient import TestClient
from app.main import app
from app.auth.jwt import create_app_token

c = TestClient(app)
t = create_app_token('OKL003', 'k.ananthu@oklut.com', 'teamlead', 'Kotesh', department='IT Support')
h = {'Authorization': f'Bearer {t}'}
paths = [
    '/api/v1/tickets/stats/summary',
    '/api/v1/notifications/unread-count',
    '/api/v1/users/profile',
    '/api/v1/users/directory',
    '/api/v1/auth/me',
]
for p in paths:
    r = c.get(p, headers=h)
    print(p, r.status_code, str(r.json())[:250])
r = c.get('/api/v1/tickets', headers=h)
print('/api/v1/tickets', r.status_code, 'count=', len(r.json()))
if r.status_code == 200 and r.json():
    print('sample', {k: r.json()[0].get(k) for k in ('id','status','department','sla_status','assigned_agent','is_unassigned')})
r = c.get('/api/v1/notifications', headers=h)
print('/api/v1/notifications', r.status_code, 'count=', len(r.json()))
r = c.get('/api/v1/tickets/stats/summary')
print('unauth stats', r.status_code)
