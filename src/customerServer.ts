import express, { Request, Response } from 'express';
import { Client, Connection } from '@temporalio/client';
import { customerSupportWorkflow, WorkflowStatus } from './workflows/customerSupportWorkflow';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── GET / — complaint submission form ──────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Customer Support — Submit Complaint</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; }
    h1 { color: #e63946; }
    label { display: block; margin-top: 16px; font-weight: 600; }
    input, textarea { width: 100%; padding: 8px; margin-top: 6px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
    textarea { height: 120px; resize: vertical; }
    button { margin-top: 20px; padding: 10px 28px; background: #e63946; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
    button:hover { background: #c1121f; }
  </style>
</head>
<body>
  <h1>Food Delivery Support</h1>
  <p>Had a problem with your order? Let us know and we'll make it right.</p>
  <form method="POST" action="/complaint">
    <label for="orderId">Order ID</label>
    <input type="text" id="orderId" name="orderId" placeholder="e.g. ORD-12345" required>

    <label for="customerId">Your Name / Customer ID</label>
    <input type="text" id="customerId" name="customerId" placeholder="e.g. John Doe" required>

    <label for="complaintText">Describe your issue</label>
    <textarea id="complaintText" name="complaintText" placeholder="Tell us what went wrong…" required></textarea>

    <button type="submit">Submit Complaint</button>
  </form>
</body>
</html>`);
});

// ── POST /complaint — start Temporal workflow ──────────────────────────────
app.post('/complaint', async (req: Request, res: Response) => {
  const { orderId, customerId, complaintText } = req.body as {
    orderId: string;
    customerId: string;
    complaintText: string;
  };

  const connection = await Connection.connect({ address: 'localhost:7233' });
  const client = new Client({ connection });

  const workflowId = `complaint-${orderId}-${Date.now()}`;

  await client.workflow.start(customerSupportWorkflow, {
    taskQueue: 'customer-support',
    workflowId,
    args: [{ orderId, customerId, complaintText }],
  });

  res.redirect(`/status/${encodeURIComponent(workflowId)}`);
});

// ── GET /status/:workflowId — live status page (polls every 3s) ───────────
app.get('/status/:workflowId', async (req: Request, res: Response) => {
  const { workflowId } = req.params;

  let status: WorkflowStatus = { status: 'processing', message: 'Your complaint is being reviewed…' };
  let isCompleted = false;

  try {
    const connection = await Connection.connect({ address: 'localhost:7233' });
    const client = new Client({ connection });
    const handle = client.workflow.getHandle(workflowId);

    status = await handle.query('getStatus') as WorkflowStatus;

    const description = await handle.describe();
    isCompleted = description.status.name === 'COMPLETED' || description.status.name === 'FAILED';
  } catch {
    // Workflow may have completed — status stays at last known value
    isCompleted = true;
  }

  const statusColors: Record<string, string> = {
    processing: '#f4a261',
    pending_human_review: '#457b9d',
    refunded: '#2a9d8f',
    rejected: '#e63946',
    escalated: '#6d6875',
  };
  const color = statusColors[status.status] ?? '#333';

  const statusLabels: Record<string, string> = {
    processing: 'Processing',
    pending_human_review: 'Under Review',
    refunded: 'Refund Approved',
    rejected: 'Not Approved',
    escalated: 'Escalated',
  };

  const refreshScript = isCompleted
    ? ''
    : `<script>setTimeout(() => location.reload(), 3000);</script>`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Complaint Status</title>
  ${refreshScript}
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; color: white; background: ${color}; font-weight: 600; font-size: 14px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; margin-top: 24px; }
    .message { font-size: 18px; margin-top: 16px; line-height: 1.5; }
    .note { margin-top: 24px; color: #666; font-size: 13px; }
    a { color: #e63946; }
  </style>
</head>
<body>
  <h1>Your Complaint Status</h1>
  <p>Complaint ID: <code>${workflowId}</code></p>
  <div class="card">
    <span class="badge">${statusLabels[status.status] ?? status.status}</span>
    <p class="message">${status.message}</p>
  </div>
  ${!isCompleted ? '<p class="note">This page refreshes automatically every 3 seconds.</p>' : ''}
  <p><a href="/">Submit another complaint</a></p>
</body>
</html>`);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`[customer-server] Listening at http://localhost:${PORT}`);
});
