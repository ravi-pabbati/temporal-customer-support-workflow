# Customer Support Refund Workflow

A prototype that automates food delivery refund decisions using **Temporal** for workflow orchestration and **Claude (Anthropic API)** for complaint classification.

## How It Works

```
Customer submits complaint
         ↓
  Claude classifies it
         ↓
missing_item ──→ auto-refund ──→ customer sees result instantly
         ↓
quality_issue ──→ workflow pauses ──→ human reviews & responds
                                           ↓
                              customer status page updates live
```

### Complaint Paths

| Complaint Type | Handler | Outcome |
|---|---|---|
| Missing item ("my burger wasn't delivered") | AI auto-approves | Refund processed immediately |
| Food quality ("pizza was cold and bad") | Human-in-the-loop | Reviewer approves or rejects with a custom message |
| Other / unclassified | Escalated | Customer is notified to expect follow-up |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Workflow orchestration | [Temporal](https://temporal.io) |
| AI classification | [Claude](https://anthropic.com) (`claude-haiku-4-5`) via Anthropic SDK |
| Runtime | Node.js + TypeScript |
| Web servers | Express |

---

## Project Structure

```
temporal-customer-support-workflow/
├── src/
│   ├── workflows/
│   │   └── customerSupportWorkflow.ts   # Temporal workflow definition
│   ├── activities/
│   │   ├── classifyComplaint.ts         # Calls Claude API to classify the complaint
│   │   ├── processRefund.ts             # Simulates refund processing
│   │   └── notifyHumanReview.ts         # Writes complaint to the review queue
│   ├── store.ts                         # File-based shared state (reviews.json)
│   ├── worker.ts                        # Temporal worker — registers workflow & activities
│   ├── customerServer.ts                # Customer-facing UI (port 3000)
│   └── humanReviewServer.ts             # Human reviewer UI (port 3001)
├── .env                                 # API key config (not committed)
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- **Node.js** v18+
- **Temporal CLI** — [install guide](https://docs.temporal.io/cli/setup-cli)
- **Anthropic API key** — [get one here](https://console.anthropic.com)

### Install Temporal CLI (Windows)

```powershell
Invoke-WebRequest -Uri "https://temporal.download/cli/archive/latest?platform=windows&arch=amd64" -OutFile temporal.zip
Expand-Archive temporal.zip -DestinationPath "C:\temporal"
# Then add C:\temporal to your system PATH
```

---

## Setup

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Add your Anthropic API key to `.env`**
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

---

## Running the App

Open **4 separate terminals** and run each command:

```bash
# Terminal 1 — Temporal server
temporal server start-dev

# Terminal 2 — Temporal worker
npm run worker

# Terminal 3 — Customer complaint UI
npm run customer-server

# Terminal 4 — Human reviewer UI
npm run review-server
```

| Service | URL |
|---|---|
| Customer complaint form | http://localhost:3000 |
| Human review portal | http://localhost:3001/reviews |
| Temporal Web UI | http://localhost:8233 |

> **Tip:** Use `temporal server start-dev --db-filename=temporal.db` to persist workflow history across server restarts.

---

## Testing the Two Flows

### Flow 1 — Missing Item (AI auto-approves)

1. Open `http://localhost:3000`
2. Enter an Order ID and your name
3. Type: *"My burger was not delivered"*
4. Submit — the status page auto-updates to **Refund Approved**

### Flow 2 — Food Quality (Human review)

1. Open `http://localhost:3000`
2. Enter an Order ID and your name
3. Type: *"The pizza was cold and tasted terrible"*
4. Submit — status shows **Under Review**
5. Open `http://localhost:3001/reviews`
6. Click **Refresh** to load pending complaints
7. Read the complaint, type a message to the customer, click **Approve Refund** or **Reject**
8. The customer status page updates with your message

---

## Key Temporal Concepts Used

| Concept | Where | Purpose |
|---|---|---|
| **Workflow** | `customerSupportWorkflow.ts` | Orchestrates the full complaint lifecycle |
| **Activities** | `activities/` | External calls (Claude API, refund, file store) |
| **Signals** | `humanDecisionSignal` | Human reviewer sends approve/reject into the paused workflow |
| **Queries** | `getStatusQuery` | Customer polls live workflow state without interrupting it |
| **`condition()`** | Workflow | Pauses execution for up to 24h waiting for human input |
