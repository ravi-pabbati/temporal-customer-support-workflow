import { Worker } from '@temporalio/worker';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { classifyComplaintActivity } from './activities/classifyComplaint';
import { processRefundActivity } from './activities/processRefund';
import { notifyHumanReviewActivity } from './activities/notifyHumanReview';

async function main() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows/customerSupportWorkflow'),
    activities: {
      classifyComplaint: classifyComplaintActivity,
      processRefund: processRefundActivity,
      notifyHumanReview: notifyHumanReviewActivity,
    },
    taskQueue: 'customer-support',
  });

  console.log('[worker] Started. Listening on task queue: customer-support');
  await worker.run();
}

main().catch(err => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
