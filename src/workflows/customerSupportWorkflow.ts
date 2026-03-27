import { proxyActivities, defineSignal, defineQuery, setHandler, condition, workflowInfo } from '@temporalio/workflow';
import type { classifyComplaintActivity } from '../activities/classifyComplaint';
import type { processRefundActivity } from '../activities/processRefund';
import type { notifyHumanReviewActivity } from '../activities/notifyHumanReview';

const { classifyComplaint, processRefund, notifyHumanReview } = proxyActivities<{
  classifyComplaint: typeof classifyComplaintActivity;
  processRefund: typeof processRefundActivity;
  notifyHumanReview: typeof notifyHumanReviewActivity;
}>({
  startToCloseTimeout: '30 seconds',
});

export interface WorkflowInput {
  orderId: string;
  customerId: string;
  complaintText: string;
}

export interface WorkflowStatus {
  status: 'processing' | 'pending_human_review' | 'refunded' | 'rejected' | 'escalated';
  message: string;
}

export interface HumanDecision {
  approved: boolean;
  reviewerMessage: string;
}

export const humanDecisionSignal = defineSignal<[HumanDecision]>('humanDecision');
export const getStatusQuery = defineQuery<WorkflowStatus>('getStatus');

export async function customerSupportWorkflow(input: WorkflowInput): Promise<WorkflowStatus> {
  const { orderId, customerId, complaintText } = input;

  let currentStatus: WorkflowStatus = { status: 'processing', message: 'Your complaint is being reviewed\u2026' };
  // Use a wrapper so TypeScript tracks mutations across closures
  const state: { decision: HumanDecision | null } = { decision: null };

  setHandler(getStatusQuery, () => currentStatus);
  setHandler(humanDecisionSignal, (decision: HumanDecision) => {
    state.decision = decision;
  });

  // Step 1: Classify the complaint using Claude
  const { category } = await classifyComplaint(complaintText);

  // Step 2a: Missing item — auto-approve refund
  if (category === 'missing_item') {
    await processRefund(orderId);
    currentStatus = {
      status: 'refunded',
      message: "We're sorry about the missing item! Your refund has been approved and will be credited within 3-5 business days.",
    };
    return currentStatus;
  }

  // Step 2b: Quality issue — pause and wait for human decision
  if (category === 'quality_issue') {
    currentStatus = {
      status: 'pending_human_review',
      message: "Our team is reviewing your request, we'll update you shortly.",
    };

    // Write to the shared file-based review queue
    const { workflowId } = workflowInfo();
    await notifyHumanReview(workflowId, orderId, customerId, complaintText);

    // Wait up to 24 hours for a human decision signal
    const received = await condition(() => state.decision !== null, '24 hours');

    if (!received || state.decision === null) {
      currentStatus = { status: 'escalated', message: 'Your complaint has been escalated to our support team.' };
      return currentStatus;
    }

    const { approved, reviewerMessage } = state.decision;
    if (approved) {
      await processRefund(orderId);
      currentStatus = { status: 'refunded', message: reviewerMessage };
    } else {
      currentStatus = { status: 'rejected', message: reviewerMessage };
    }
    return currentStatus;
  }

  // Step 2c: Other / unclassified — escalate
  currentStatus = { status: 'escalated', message: 'Your complaint has been escalated to our support team.' };
  return currentStatus;
}
