import express, { Request, Response } from 'express';
import { Client, Connection } from '@temporalio/client';
import { humanDecisionSignal } from './workflows/customerSupportWorkflow';
import { getPendingReviews, removePendingReview } from './store';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── GET /reviews — pending quality-issue reviews ───────────────────────────
app.get('/reviews', (_req: Request, res: Response) => {
  const reviews = getPendingReviews();

  const cards = reviews.length === 0
    ? '<p style="color:#666;">No pending reviews. Check back later.</p>'
    : reviews.map(r => `
      <div class="card">
        <div class="meta">
          <span class="label">Order ID</span> ${r.orderId} &nbsp;|&nbsp;
          <span class="label">Customer</span> ${r.customerId} &nbsp;|&nbsp;
          <span class="label">Submitted</span> ${new Date(r.submittedAt).toLocaleString()}
        </div>
        <div class="complaint">"${r.complaintText}"</div>
        <form method="POST" action="/reviews/${encodeURIComponent(r.workflowId)}/decision">
          <label for="msg-${r.workflowId}">Message to customer</label>
          <textarea id="msg-${r.workflowId}" name="reviewerMessage" rows="3" placeholder="Explain your decision to the customer…" required></textarea>
          <div class="actions">
            <button type="submit" name="approved" value="true" class="btn-approve">Approve Refund</button>
            <button type="submit" name="approved" value="false" class="btn-reject">Reject</button>
          </div>
        </form>
      </div>
    `).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Human Review Queue</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #1d3557; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .meta { font-size: 13px; color: #555; margin-bottom: 12px; }
    .label { font-weight: 600; color: #333; }
    .complaint { font-size: 16px; font-style: italic; margin-bottom: 16px; color: #1d3557; background: #f0f4f8; padding: 12px; border-radius: 4px; }
    textarea { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-top: 6px; margin-bottom: 12px; }
    label { font-weight: 600; font-size: 14px; }
    .actions { display: flex; gap: 12px; }
    .btn-approve { padding: 10px 24px; background: #2a9d8f; color: white; border: none; border-radius: 4px; font-size: 15px; cursor: pointer; }
    .btn-approve:hover { background: #1d7a6d; }
    .btn-reject { padding: 10px 24px; background: #e63946; color: white; border: none; border-radius: 4px; font-size: 15px; cursor: pointer; }
    .btn-reject:hover { background: #c1121f; }
    .note { color: #888; font-size: 13px; margin-top: 8px; }
    .btn-refresh { padding: 8px 20px; background: #1d3557; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer; }
    .btn-refresh:hover { background: #457b9d; }
  </style>
</head>
<body>
  <h1>Human Review Queue</h1>
  <p>${reviews.length} complaint(s) awaiting review. <button class="btn-refresh" onclick="location.reload()">Refresh</button></p>
  ${cards}
  <p class="note">Human Review Portal — internal use only.</p>
</body>
</html>`);
});

// ── POST /reviews/:workflowId/decision — send signal to workflow ───────────
app.post('/reviews/:workflowId/decision', async (req: Request, res: Response) => {
  const { workflowId } = req.params;
  const approved = req.body.approved === 'true';
  const reviewerMessage = (req.body.reviewerMessage as string).trim();

  const connection = await Connection.connect({ address: 'localhost:7233' });
  const client = new Client({ connection });
  const handle = client.workflow.getHandle(workflowId);

  await handle.signal(humanDecisionSignal, { approved, reviewerMessage });
  removePendingReview(workflowId);

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Decision Sent</title>
  <meta http-equiv="refresh" content="2;url=/reviews">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; }
    .ok { color: #2a9d8f; font-size: 20px; }
  </style>
</head>
<body>
  <p class="ok">Decision sent (${approved ? 'Approved' : 'Rejected'}). Redirecting back…</p>
</body>
</html>`);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[review-server] Listening at http://localhost:${PORT}/reviews`);
});
