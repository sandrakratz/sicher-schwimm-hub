-- Löschkonzept 2027, Ergänzung (Vorstand 27.11.2026): Nachweise zu Führungszeugnissen bleiben bis
-- 2 Jahre nach dem Ausscheiden (Rolle „Trainer/in“ entfernt, siehe trainer_departures) und werden dann
-- gelöscht. Ersetzt run_retention_2027 aus 20261127120000_retention_2027.sql um Regel 17b; alles andere
-- bleibt gleich. Plant nichts ein und löscht beim Einspielen nichts.
-- Voraussetzung: Migration 20261128100000_fz_history.sql.

CREATE OR REPLACE FUNCTION public.run_retention_2027(dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  y int := extract(year FROM (now() AT TIME ZONE 'Europe/Berlin'))::int;
  cut3 date;  -- Anlass vor diesem Tag = 3 Jahre nach Ende seines Kalenderjahres vorbei
  cut5 date;
  cut8 date;
  n int;
  res jsonb := '{}'::jsonb;
BEGIN
  cut3 := make_date(y - 3, 1, 1);
  cut5 := make_date(y - 5, 1, 1);
  cut8 := make_date(y - 8, 1, 1);

  BEGIN
    -- 1) Anwesenheit der Kinder: 2 Jahre nach dem Termin
    DELETE FROM public.course_attendance a
     USING public.course_sessions s
     WHERE a.session_id = s.id AND s.session_date < today - interval '2 years';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('anwesenheit_kinder', n);

    -- 2) Trainer: Anwesenheit, Einteilung, Verfügbarkeit, Dienstplan-Protokoll: 2 Jahre nach dem Termin
    DELETE FROM public.trainer_session_attendance a
     USING public.course_sessions s
     WHERE a.session_id = s.id AND s.session_date < today - interval '2 years';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('trainer_anwesenheit', n);
    DELETE FROM public.course_session_assignments a
     USING public.course_sessions s
     WHERE a.session_id = s.id AND s.session_date < today - interval '2 years';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('trainer_einteilung', n);
    DELETE FROM public.course_session_availability a
     USING public.course_sessions s
     WHERE a.session_id = s.id AND s.session_date < today - interval '2 years';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('trainer_verfuegbarkeit', n);
    DELETE FROM public.dienstplan_log
     WHERE coalesce(session_date, created_at::date) < today - interval '2 years';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('dienstplan_protokoll', n);

    -- 3) Prüfungsprotokolle: 5 Jahre nach Prüfungsjahr (eigene Kurse: Felder leeren; extern: löschen)
    UPDATE public.course_participants p
       SET exam_date = NULL, exam_level = NULL, exam_criteria = DEFAULT, exam_pass_no = NULL,
           exam_recorded_at = NULL, exam_recorded_by = NULL, badge = NULL, achievement = NULL,
           goal_reached = NULL
      FROM public.courses c
     WHERE p.course_id = c.id
       AND coalesce(p.exam_date, p.exam_recorded_at::date, c.ends_on, p.created_at::date) < cut5
       AND (p.exam_date IS NOT NULL OR p.exam_pass_no IS NOT NULL OR p.badge IS NOT NULL
            OR p.achievement IS NOT NULL OR p.goal_reached IS NOT NULL OR p.exam_level IS NOT NULL);
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('pruefung_geleert', n);
    DELETE FROM public.external_badge_exams WHERE exam_date < cut5;
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('externe_pruefungen', n);

    -- 4) Nie bezahlte, beendete Buchungen ohne Anwesenheit und ohne Prüfung: 6 Monate nach Ende
    DELETE FROM public.course_participants p
     WHERE p.status = 'cancelled' AND NOT p.paid
       AND coalesce(p.removed_at, p.cancelled_at, p.transferred_at, p.updated_at)
           < now() - interval '6 months'
       AND NOT EXISTS (SELECT 1 FROM public.course_attendance a
                        WHERE a.participant_id = p.id AND a.status = 'present')
       AND p.exam_date IS NULL AND p.exam_pass_no IS NULL AND p.badge IS NULL
       AND p.achievement IS NULL AND p.goal_reached IS NULL AND p.exam_level IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('buchung_nie_bezahlt', n);

    -- 5) Gebucht, nie bezahlt, Kurs vorbei (offene Forderung): 3 Jahre nach Kursjahr
    DELETE FROM public.course_participants p
     USING public.courses c
     WHERE p.course_id = c.id AND p.status <> 'cancelled' AND NOT p.paid
       AND coalesce(c.ends_on, p.created_at::date) < cut3
       AND p.exam_date IS NULL AND p.exam_pass_no IS NULL AND p.badge IS NULL
       AND p.achievement IS NULL AND p.goal_reached IS NULL AND p.exam_level IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('buchung_offene_forderung', n);

    -- 6) Bezahlte Buchungen: 3 Jahre nach Kursjahr auf den Beleg-Kern schrumpfen
    --    (bleibt: Kind, Rechnungsanschrift, Kurs, Betrag, Daten, Nummern; Geburtsdatum nur solange Prüfung)
    UPDATE public.course_participants p
       SET participant_email = NULL, participant_phone = NULL, notes = NULL, internal_notes = NULL,
           payment_note = NULL, cancel_reason = NULL, transfer_reason = NULL, belt_blocks = NULL,
           push_token = NULL,
           date_of_birth = CASE WHEN p.exam_date IS NULL AND p.exam_pass_no IS NULL AND p.badge IS NULL
                                THEN NULL ELSE p.date_of_birth END
      FROM public.courses c
     WHERE p.course_id = c.id AND p.paid
       AND coalesce(c.ends_on, p.created_at::date) < cut3
       AND (p.participant_email IS NOT NULL OR p.participant_phone IS NOT NULL OR p.notes IS NOT NULL
            OR p.internal_notes IS NOT NULL OR p.payment_note IS NOT NULL OR p.cancel_reason IS NOT NULL
            OR p.transfer_reason IS NOT NULL OR p.belt_blocks IS NOT NULL OR p.push_token IS NOT NULL
            OR (p.date_of_birth IS NOT NULL AND p.exam_date IS NULL AND p.exam_pass_no IS NULL
                AND p.badge IS NULL));
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('buchung_auf_beleg_kern', n);

    -- 7) Beleg-Kern: 8 Jahre nach Zahlungsjahr löschen (Prüfung ist dann längst geleert)
    DELETE FROM public.course_participants p
     WHERE p.paid AND coalesce(p.paid_at, p.created_at)::date < cut8
       AND p.exam_date IS NULL AND p.exam_pass_no IS NULL AND p.badge IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('beleg_kern_geloescht', n);

    -- 8) Push-Abos der Eltern: 1 Monat nach Kursende bzw. Absage
    DELETE FROM public.push_subscriptions ps
     USING public.course_participants p JOIN public.courses c ON c.id = p.course_id
     WHERE ps.participant_id = p.id
       AND (c.ends_on < today - interval '1 month'
            OR (p.status = 'cancelled' AND p.updated_at < now() - interval '1 month'));
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('push_abos', n);

    -- 9) Nie bestätigte Umbuchungs-Links: 6 Monate nach Anlage. Bestätigte Zustimmungen (mit Gebühr)
    --    gehören zum Beleg und gehen erst mit der Buchung; Volljährigkeits-Bestätigungen sind
    --    Einwilligungsnachweis und gehen erst mit der Mitgliedschaft (beides per CASCADE).
    DELETE FROM public.course_transfer_consents
     WHERE confirmed_at IS NULL AND created_at < now() - interval '6 months';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('umbuchungs_links_offen', n);

    -- 10) Warteliste: 6 Monate nach Abmeldung, Absage, Fristablauf oder Buchung
    DELETE FROM public.waitlist_entries
     WHERE status IN ('removed', 'declined', 'expired', 'accepted')
       AND updated_at < now() - interval '6 months';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('warteliste', n);

    -- 11) Kursanfragen: 6 Monate nach Abschluss, wenn nichts Aktives mehr daran hängt
    DELETE FROM public.course_requests r
     WHERE r.status IN ('rejected', 'accepted', 'waiting_list')
       AND r.updated_at < now() - interval '6 months'
       AND NOT EXISTS (SELECT 1 FROM public.waitlist_entries w
                        WHERE w.request_id = r.id AND w.status IN ('waiting', 'offered'))
       AND NOT EXISTS (SELECT 1 FROM public.course_participants p
                         JOIN public.courses c ON c.id = p.course_id
                        WHERE p.request_id = r.id AND p.status <> 'cancelled'
                          AND (c.ends_on IS NULL OR c.ends_on >= today - interval '6 months'));
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('kursanfragen', n);

    -- 12) Erwachsenenkurs-Interessen und Kontaktformular: 6 Monate nach Erledigung
    DELETE FROM public.adult_course_interests
     WHERE status IN ('not_interested', 'converted') AND updated_at < now() - interval '6 months';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('erwachsenen_interessen', n);
    DELETE FROM public.messages
     WHERE status IN ('replied', 'archived') AND updated_at < now() - interval '6 months';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('kontaktformular', n);

    -- 13) Helfer-Rückmeldungen: 6 Monate nach dem Event
    DELETE FROM public.event_shift_signups s
     USING public.events e
     WHERE s.event_id = e.id AND coalesce(e.ends_at, e.starts_at) < now() - interval '6 months';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('helfer_rueckmeldungen', n);

    -- 14) Rundschreiben im Portal: 2 Jahre nach Versand
    DELETE FROM public.member_messages WHERE created_at < now() - interval '2 years';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('rundschreiben', n);

    -- 15) Beendete Mitgliedschaften: 3 Jahre nach „gültig bis“ (sonst letzter Änderung)
    DELETE FROM public.memberships
     WHERE status = 'terminated' AND coalesce(valid_until, updated_at::date) < cut3;
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('mitgliedschaften', n);

    -- 16) Sperrliste: 2 Jahre nach Eintrag, außer verlängert
    DELETE FROM public.booking_blocklist
     WHERE coalesce(keep_until, (created_at + interval '2 years')::date) < today;
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('sperrliste', n);

    -- 17) Übungsleiter: Auszahlungen (samt Posten) und Jahreserklärungen 8 Jahre nach dem Jahr
    DELETE FROM public.trainer_payouts WHERE paid_on < cut8;
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('trainer_auszahlungen', n);
    DELETE FROM public.trainer_declarations WHERE year < y - 8;
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('trainer_erklaerungen', n);

    -- 17b) Führungszeugnisse: Nachweis der Einsicht bis 2 Jahre nach dem Ausscheiden (Rolle „Trainer/in“
    --      entfernt; Versicherungsmeldungen, Vorstand 27.11.2026). Danach Historie, Eintrag und
    --      Prüfvermerk löschen, zuletzt den Ausscheide-Vermerk selbst.
    DELETE FROM public.trainer_fz_checks c
     USING public.trainer_departures d
     WHERE c.trainer_id = d.trainer_id AND d.left_at < today - interval '2 years';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('fuehrungszeugnis_nachweise', n);
    DELETE FROM public.trainer_qualifications q
     USING public.trainer_departures d
     WHERE q.trainer_id = d.trainer_id AND q.kind = 'fuehrungszeugnis'
       AND d.left_at < today - interval '2 years';
    DELETE FROM public.trainer_qualification_checks k
     USING public.trainer_departures d
     WHERE k.trainer_id = d.trainer_id AND k.kind = 'fuehrungszeugnis'
       AND d.left_at < today - interval '2 years';
    DELETE FROM public.trainer_departures WHERE left_at < today - interval '2 years';

    -- 18) Änderungsprotokoll: 24 Monate
    DELETE FROM public.audit_logs WHERE created_at < now() - interval '24 months';
    GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('aenderungsprotokoll', n);

    IF dry_run THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'retention_2027_dry_run';
    END IF;
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> 'retention_2027_dry_run' THEN RAISE; END IF;
      -- Probelauf: alle Änderungen dieses Blocks sind zurückgerollt, die Zählung bleibt.
  END;

  res := jsonb_build_object('probelauf', dry_run, 'stand', today) || res;
  IF NOT dry_run THEN
    INSERT INTO public.audit_logs (actor_id, action, entity, metadata)
    VALUES (NULL, 'retention_cleanup_2027', 'system', res);
  END IF;
  RETURN res;
END;
$$;

REVOKE ALL ON FUNCTION public.run_retention_2027(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_retention_2027(boolean) TO service_role;

COMMENT ON FUNCTION public.run_retention_2027(boolean) IS
  'Löschkonzept 2027. Standard = Probelauf (zählt nur). Echter Lauf: run_retention_2027(false). Zeitplan separat.';
