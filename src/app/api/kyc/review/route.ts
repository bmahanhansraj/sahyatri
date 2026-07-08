import { z } from 'zod';
import { KycStatus } from '@/generated/prisma/enums';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole, AuthError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { sendSms } from '@/lib/integrations';

/** Approve / Reject with mandatory remarks on rejection (PRD §5.2). */
export async function POST(req: Request) {
  try {
    const reviewer = await requireRole('KYC_APPROVER', 'SUPER_ADMIN');
    const schema = z.object({ submissionId: z.string(), decision: z.string(), remarks: z.string().optional() });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { submissionId, decision, remarks } = parsed.data;
    if (!['APPROVED','REJECTED'].includes(decision)) return NextResponse.json({error:'Invalid decision'},{status:400});
    if (!['APPROVED', 'REJECTED'].includes(decision))
      return NextResponse.json({ error: 'Decision must be Approve or Reject' }, { status: 400 });
    if (decision === 'REJECTED' && !remarks?.trim())
      return NextResponse.json({ error: 'Remarks are required when rejecting a submission' }, { status: 400 });

    const sub = await prisma.kycSubmission.update({
      where: { id: submissionId },
      data: { status: decision as KycStatus, remarks, reviewerId: reviewer.id, reviewedAt: new Date() },
      include: { user: true },
    });
    await prisma.user.update({
      where: { id: sub.userId },
      data: {
        kycStatus: decision as KycStatus,
        kycExpiresAt: decision === 'APPROVED' ? new Date(Date.now() + 365 * 24 * 3600 * 1000) : null,
      },
    });
    await audit(`KYC ${decision.toLowerCase()}`, { actorId: reviewer.id, entity: 'KycSubmission', entityId: sub.id });
    await sendSms(sub.user.phone, `Sahyatri: your KYC was ${decision.toLowerCase()}.${remarks ? ' ' + remarks : ''}`);
    return NextResponse.json(sub);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
