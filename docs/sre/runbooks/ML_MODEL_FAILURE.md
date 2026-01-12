# Runbook: ML Model Failure

## Alert

`ml-model-not-loaded` - Risk ML model not loaded or failed

## Symptoms

- risk-ml-service returning errors
- `ml_model_loaded` metric = 0
- Risk scores not available
- Model inference timeouts

## Impact

- Risk assessments unavailable
- Compliance workflow blocked
- Address screening fails
- High-risk transactions may pass

## Diagnosis

```bash
# 1. Check model status
curl -sf http://localhost:8082/health | jq '.models'

# 2. Check service logs
docker compose logs --tail=200 risk-ml-service | grep -i "model\|load\|error"

# 3. Check model files
docker compose exec risk-ml-service ls -la /app/models/

# 4. Check memory usage
docker stats --no-stream risk-ml-service
```

## Resolution Steps

### Step 1: Identify Failure Reason

| Error | Cause | Fix |
|-------|-------|-----|
| FileNotFoundError | Model file missing | Re-download model |
| MemoryError | OOM during load | Increase container memory |
| ValueError | Model version mismatch | Check compatibility |
| TimeoutError | Slow model load | Increase startup timeout |

### Step 2: Model Reload

```bash
# Trigger model reload via API (if supported)
curl -X POST http://localhost:8082/api/models/reload

# Or restart service
docker compose restart risk-ml-service

# Watch startup logs
docker compose logs -f risk-ml-service | grep -i "model"
```

### Step 3: Manual Model Recovery

```bash
# Check model artifacts
docker compose exec risk-ml-service ls -la /app/models/

# Re-download model (if corrupted)
docker compose exec risk-ml-service python -c "
from app.models import download_models
download_models()
"

# Verify model integrity
docker compose exec risk-ml-service python -c "
import joblib
model = joblib.load('/app/models/risk_model.pkl')
print(f'Model loaded: {type(model)}')
"
```

### Step 4: Verify Recovery

```bash
# Health check
curl -sf http://localhost:8082/health | jq '.status'

# Model loaded metric
curl -sf http://localhost:8082/metrics | grep ml_model_loaded

# Test inference
curl -sf -X POST http://localhost:8082/api/risk/score \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"}'
```

## Fallback Options

If model cannot be recovered quickly:

1. **Default scores**: Return conservative default score (0.5)
2. **Rule-based fallback**: Use simple rule engine
3. **Manual review**: Route to human review queue

```bash
# Enable fallback mode (if supported)
curl -X POST http://localhost:8082/api/config \
  -H "Content-Type: application/json" \
  -d '{"fallback_enabled": true}'
```

## Model Management

| Version | Location | Last Updated |
|---------|----------|--------------|
| v1.0 | /app/models/risk_model_v1.pkl | 2026-01-01 |
| v1.1 | /app/models/risk_model_v1.1.pkl | 2026-01-10 |

## Escalation

| Time | Action |
|------|--------|
| 2min | Check logs, attempt restart |
| 10min | Enable fallback mode |
| 30min | Page ML team |
| 60min | Consider manual review process |

---

**Alert UID**: ml-model-not-loaded  
**Last Updated**: 2026-01-12
