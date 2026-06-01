import { apiClient, endpoints } from "@/shared/api";

/**
 * Change le mot de passe de l'utilisateur connecté via l'API backend.
 * Le backend vérifie l'ancien mot de passe puis met à jour le compte
 * et désactive le flag `must_change_password` dans les user_metadata.
 */
export async function changePassword(input: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  await apiClient.post(endpoints.auth.changePassword, input);
}