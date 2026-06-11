import { supabase } from "@/integrations/supabase/client";

export type UploadBucket = "avatars" | "student-photos" | "school-assets" | "staff-photos";

const PRIVATE_BUCKETS: UploadBucket[] = ["student-photos", "staff-photos"];
// ~10 years, used so URLs stored in DB keep resolving for private buckets.
const LONG_LIVED_SIGNED_URL_SECONDS = 60 * 60 * 24 * 365 * 10;

/**
 * Téléverse un fichier dans un bucket Storage et retourne une URL utilisable.
 * - Buckets publics (avatars, school-assets) : URL publique.
 * - Buckets privés (student-photos, staff-photos) : URL signée longue durée.
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

  if (PRIVATE_BUCKETS.includes(bucket)) {
    const { data, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, LONG_LIVED_SIGNED_URL_SECONDS);
    if (signErr || !data?.signedUrl) throw new Error(signErr?.message ?? "Signing failed");
    return data.signedUrl;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
