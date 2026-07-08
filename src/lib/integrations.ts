/**
 * Third-party integration layer (PRD §14, §15).
 * Each function runs in STUB MODE when its API key is missing, so the whole
 * platform works end-to-end in demos and staging without external accounts.
 * Adding the real key in .env switches it live — no code changes needed elsewhere.
 */

/** 2Factor.in SMS gateway — OTPs, ride reminders, driver-arrival alerts (PRD §13). */
export async function sendSms(phone: string, message: string): Promise<{ ok: boolean; stub: boolean }> {
  const key = process.env.TWOFACTOR_API_KEY;
  if (!key) {
    console.log(`[SMS stub] to ${phone}: ${message}`);
    return { ok: true, stub: true };
  }
  const res = await fetch(
    `https://2factor.in/API/V1/${key}/SMS/${encodeURIComponent(phone)}/AUTOGEN`,
    { method: 'GET' }
  );
  return { ok: res.ok, stub: false };
}

/** Razorpay order creation — wallet top-ups, UPI/card booking fees (PRD §14). */
export async function createRazorpayOrder(
  amountPaise: number,
  receipt: string
): Promise<{ orderId: string; stub: boolean }> {
  const id = process.env.RAZORPAY_KEY_ID;
  const secretKey = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secretKey) {
    return { orderId: `stub_order_${Date.now()}`, stub: true };
  }
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secretKey}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }),
  });
  const data = await res.json();
  return { orderId: data.id, stub: false };
}

/** DigiLocker / Vahan document verification (PRD §15) — stubbed for MVP. */
export async function verifyDocumentViaDigiLocker(
  documentType: string,
  documentRef: string
): Promise<{ verified: boolean; stub: boolean }> {
  if (!process.env.DIGILOCKER_CLIENT_ID) {
    return { verified: true, stub: true }; // human KYC Approver remains the real gate in MVP
  }
  // Real DigiLocker OAuth + pull flow goes here.
  return { verified: false, stub: false };
}
