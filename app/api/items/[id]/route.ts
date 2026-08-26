import { NextRequest, NextResponse } from "next/server";
import { deleteItem, updateItemPriority } from "@/lib/db";
import { PRIORITIES } from "@/lib/constants";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await deleteItem(itemId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { priority } = await req.json();
  if (!PRIORITIES.includes(priority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  await updateItemPriority(itemId, priority);
  return NextResponse.json({ ok: true, priority });
}
