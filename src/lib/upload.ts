import { supabase } from "@/integrations/supabase/client";

export type UploadBucket = "avatars" | "student-photos" | "school-assets" | "staff-photos";

/**
 * Téléverse un fichier dans un bucket Storage et retourne l'URL publique.
 * Le chemin est préfixé par l'id utilisateur courant pour respecter les RLS.
 */
export async function uploadPublicFile(
  bucket: UploadBucket,
  file: File,
  prefix?: string,
): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id ?? "anon";
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safe = (prefix ?? "file").replace(/[^a-z0-9_-]/gi, "_");
  const path = `${uid}/${safe}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
