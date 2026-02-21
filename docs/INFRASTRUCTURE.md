# Infrastructure Guidance

## Private-use minimum (single user, small-cap paper/live assist)

### Suggested server spec
- 2 vCPU
- 4 GB RAM
- 40 GB SSD
- Stable internet, low packet loss

### Services
- Web/API app (Node)
- File storage for position artifacts (JSON/MD/PDF)
- Optional SQLite/Postgres
- Scheduler for periodic scans

### Agent runtime safety
- Start with max 4 concurrent specialist tasks on this machine.
- Keep execution human-approved in early stage.

## Scale path for SaaS (multi-user)

### Phase 1: Team/private beta
- 1 app instance + managed Postgres
- Queue worker for scan/research jobs
- Object storage for PDFs/artifacts

### Phase 2: Multi-tenant SaaS
- Stateless API pods behind load balancer
- Dedicated worker pool (queue-based)
- Tenant-level agent concurrency limits
- Usage metering per model/provider per tenant
- Billing service (subscription + usage markup)

### Phase 3: Agent swarm tiers
- Tiered plans by concurrent agents, scan frequency, and model class
- Dynamic autoscaling workers by queue depth
- Isolated execution sandboxes for premium tiers

## AI API markup model (business)
- Meter raw provider usage (OpenAI/Claude)
- Add configurable margin (e.g., 15%–35%)
- Expose transparent usage dashboards to users
- Enforce hard spending caps per workspace/wallet

## Security must-haves before SaaS
- Per-tenant secrets vault
- Wallet key isolation (never plaintext)
- Role-based access control + audit logs
- Rate limits + abuse protection
- Compliance-ready logs for trade decision traceability
