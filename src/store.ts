import * as fs from 'fs';
import * as path from 'path';

const STORE_PATH = path.join(__dirname, '..', 'reviews.json');

export interface PendingReview {
  workflowId: string;
  orderId: string;
  customerId: string;
  complaintText: string;
  submittedAt: string;
}

function readStore(): PendingReview[] {
  if (!fs.existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeStore(reviews: PendingReview[]): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(reviews, null, 2));
}

export function addPendingReview(review: PendingReview): void {
  const reviews = readStore();
  reviews.push(review);
  writeStore(reviews);
}

export function getPendingReviews(): PendingReview[] {
  return readStore();
}

export function removePendingReview(workflowId: string): void {
  const reviews = readStore().filter(r => r.workflowId !== workflowId);
  writeStore(reviews);
}
