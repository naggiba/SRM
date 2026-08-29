import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const f = createUploadthing();

// FileRouter для Uploadthing
export const ourFileRouter = {
  // Завантаження фото товарів
  imageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 10,
    },
  })
    .middleware(async () => {
      const session = await getServerSession(authOptions);
      const role = (session?.user as { role?: string } | undefined)?.role;
      
      if (!session || role === "VIEWER") {
        throw new Error("Доступ заборонено");
      }
      
      return { userId: session.user?.email };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for:", metadata.userId);
      console.log("File URL:", file.ufsUrl);
      
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
