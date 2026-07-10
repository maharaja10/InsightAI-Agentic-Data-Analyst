import requests
import json

resp = requests.post('http://localhost:8000/api/chat/', json={
    'message': 'Are there any anomalies in the sales data? Explain what they mean.',
    'session_id': 'test_anomaly_final',
    'files': ['sales_data.csv'],
    'agent_mode': 'anomaly',
    'history': []
}, timeout=120)

data = resp.json()
print('HTTP Status:', resp.status_code)
print()
print('=== INSIGHTS / LLM INTERPRETATION ===')
print(data.get('insights', '(none returned)'))
print()
print('=== ANOMALIES DETECTED ===')
anomalies = data.get('anomalies') or []
print(f'{len(anomalies)} anomalous records found')
for i, a in enumerate(anomalies):
    print(f'  #{i+1}: {json.dumps(a)}')
print()
print('=== REASONING TRACE ===')
print(data.get('reasoning', ''))
