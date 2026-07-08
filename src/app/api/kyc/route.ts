import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { verifyDocumentViaDigiLocker } from '@/lib/integrations';

/** Rider/driver submits KYC documents (DigiLocker/Vahan stub in MVP — PRD §15). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { documentType, documentRef } = await req.json();
    if (!documentType || !documentRef)
      return NextResponse.json({ error: 'Choose a document type and enter its number' }, { status: 400 });

    const existing = await prisma.kycSubmission.findFirst({
      where: { userId: user.id, status: 'PENDING' },
    });
    if (existing)
      return NextResponse.json({ error: 'Your previous KYC submission is still under review.' }, { status: 409 });
    await verifyDocumentViaDigiLocker(documentType, documentRef); // pre-check; human approver is the gate
    await prisma.kycSubmission.create({ data: { userId: user.id, documentType, documentRef } });
    await prisma.user.update({ where: { id: user.id }, data: { kycStatus: 'PENDING' } });
    return NextResponse.json({ status: 'PENDING' }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}

/** KYC Approver queue (PRD §5.2). */
export async function GET() {
  try {
    await (await import('@/lib/auth')).requireRole('KYC_APPROVER', 'SUPER_ADMIN');
    const queue = await prisma.kycSubmission.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { name: true, phone: true, roles: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(queue);
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
