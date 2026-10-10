import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DraftEditor } from "@/components/draft-editor";

export default async function EditDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const draft = await prisma.draft.findFirst({
    where: { id, userId: session!.user!.id },
  });
  if (!draft) notFound();

  return (
    <DraftEditor
      draftId={draft.id}
      initial={{
        name: draft.name,
        subject: draft.subject,
        htmlBody: draft.htmlBody,
        textBody: draft.textBody,
      }}
    />
  );
}
