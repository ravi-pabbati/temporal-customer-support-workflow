export async function processRefundActivity(orderId: string): Promise<void> {
  // Simulate refund processing (in production: call payment/order API)
  console.log(`[refund] REFUND PROCESSED for order ${orderId} at ${new Date().toISOString()}`);
}
