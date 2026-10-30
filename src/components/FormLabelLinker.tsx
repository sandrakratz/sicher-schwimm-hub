import { useEffect } from "react";

/**
 * Verknüpft Beschriftungen mit ihrem Feld, wenn dies im Formular nicht ausdrücklich
 * geschehen ist (Label ohne `for`). Damit lesen Screenreader die Beschriftung vor,
 * und ein Klick auf den Text fokussiert das Feld. Betrifft v. a. die vielen
 * Verwaltungsformulare und Auswahlfelder.
 */
const CONTROL =
  "input:not([type=hidden]),textarea,select,button[role=combobox],button[role=switch],button[role=checkbox]";
const TOGGLE = "input[type=checkbox],input[type=radio],button[role=switch],button[role=checkbox]";

let counter = 0;

function bind(label: HTMLLabelElement, control: Element) {
  if (!control.id) control.id = `auto-field-${++counter}`;
  label.htmlFor = control.id;
}

function linkLabels() {
  document.querySelectorAll<HTMLLabelElement>("label:not([for])").forEach((label) => {
    if (label.querySelector(CONTROL)) return; // Feld steckt im Label: bereits verknüpft

    const prev = label.previousElementSibling;
    if (prev?.matches(TOGGLE)) {
      bind(label, prev);
      return;
    }

    for (let el = label.nextElementSibling; el; el = el.nextElementSibling) {
      if (el.tagName === "LABEL") return;
      const control = el.matches(CONTROL) ? el : el.querySelector(CONTROL);
      if (control) {
        bind(label, control);
        return;
      }
    }
  });
}

export function FormLabelLinker() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(linkLabels);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
