import { NextRequest, NextResponse } from "next/server";
import { deleteItem } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await deleteItem(itemId);
  return NextResponse.json({ ok: true });
}
