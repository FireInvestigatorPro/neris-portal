import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, context: { params: Promise<{ departmentId: string }> }) {
  const { departmentId } = await context.params;

  return NextResponse.json({
    message: "Department detail route placeholder",
    departmentId: id,
  });
}
