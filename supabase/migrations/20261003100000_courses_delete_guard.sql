-- Ein Kurs mit Buchungen darf nicht gelöscht werden: course_participants hängt per ON DELETE CASCADE
-- am Kurs, ein Löschen würde Buchungen, Zahlungen und Rechnungsnummern mit entfernen.
-- Solche Kurse werden archiviert (courses.archived_at).
CREATE OR REPLACE FUNCTION public.prevent_course_delete_with_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.course_participants WHERE course_id = OLD.id) THEN
    RAISE EXCEPTION 'Kurs hat Buchungen und kann nicht gelöscht werden. Bitte archivieren.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_courses_prevent_delete ON public.courses;
CREATE TRIGGER trg_courses_prevent_delete
  BEFORE DELETE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_course_delete_with_participants();
