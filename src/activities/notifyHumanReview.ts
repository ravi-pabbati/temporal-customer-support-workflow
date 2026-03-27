import { addPendingReview } from '../store';

export async function notifyHumanReviewActivity(
  workflowId: string,
  orderId: string,
  customerId: string,
  complaintText: string
): Promise<void> {
  const review = {
    workflowId,
    orderId,
    customerId,
    complaintText,
    submittedAt: new Date().toISOString(),
  };
  addPendingReview(review);
  console.log(`[human-review] Queued complaint for manual review — workflow: ${workflowId}, order: ${orderId}`);
}
