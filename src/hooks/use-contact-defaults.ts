import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ContactDefaults = {
  signedIn: boolean;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
  dateOfBirth: string;
  isMember: boolean | null;
};

const EMPTY: ContactDefaults = {
  signedIn: false,
  email: "",
  firstName: "",
  lastName: "",
  fullName: "",
  phone: "",
  street: "",
  zip: "",
  city: "",
  dateOfBirth: "",
  isMember: null,
};

/**
 * Liefert die bereits bekannten Kontaktdaten der angemeldeten Person
 * (Profil + Mitgliedschaft), damit Formulare vorausgefüllt werden können.
 * Für Gäste werden leere Werte zurückgegeben.
 */
export function useContactDefaults() {
  const query = useQuery({
    queryKey: ["contact-defaults"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ContactDefaults> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return EMPTY;

      const [{ data: profile }, { data: membership }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email,first_name,last_name,phone,address_street,address_zip,address_city,date_of_birth")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("memberships")
          .select("status,phone,address_street,address_zip,address_city,date_of_birth,first_name,last_name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const first = profile?.first_name ?? membership?.first_name ?? "";
      const last = profile?.last_name ?? membership?.last_name ?? "";
      return {
        signedIn: true,
        email: profile?.email ?? user.email ?? "",
        firstName: first,
        lastName: last,
        fullName: [first, last].filter(Boolean).join(" "),
        phone: profile?.phone ?? membership?.phone ?? "",
        street: profile?.address_street ?? membership?.address_street ?? "",
        zip: profile?.address_zip ?? membership?.address_zip ?? "",
        city: profile?.address_city ?? membership?.address_city ?? "",
        dateOfBirth: profile?.date_of_birth ?? membership?.date_of_birth ?? "",
        isMember: membership ? membership.status === "active" : null,
      };
    },
  });

  return { defaults: query.data ?? EMPTY, ready: !query.isLoading };
}
