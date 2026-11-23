import { useRef, useState } from "react";
import {
  CHILDREN_WITHOUT_PROOF,
  INITIAL_CHILD_ROWS,
  MAX_CHILDREN,
  emptyFamilyMember,
  filledCount,
  type FamilyMember,
} from "./membership-form";

/** Partner/in und Kinder der Familienmitgliedschaft (bleibt beim Wechsel der Mitgliedsart erhalten). */
export function useFamilyMembers() {
  const [partner, setPartner] = useState<FamilyMember>(emptyFamilyMember);
  const [children, setChildren] = useState<FamilyMember[]>(() =>
    Array.from({ length: INITIAL_CHILD_ROWS }, emptyFamilyMember),
  );
  // Ab dem 4. eingetragenen Kind: Hinweis auf die Haushaltsbescheinigung (einmalig als Popup).
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const proofShown = useRef(false);

  const updatePartner = (patch: Partial<FamilyMember>) => setPartner((p) => ({ ...p, ...patch }));
  const updateChild = (i: number, patch: Partial<FamilyMember>) => {
    const next = children.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    setChildren(next);
    if (!proofShown.current && filledCount(next) > CHILDREN_WITHOUT_PROOF) {
      proofShown.current = true;
      setProofDialogOpen(true);
    }
  };
  const addChild = () =>
    setChildren((prev) => (prev.length >= MAX_CHILDREN ? prev : [...prev, emptyFamilyMember()]));
  const removeLastChild = () =>
    setChildren((prev) => (prev.length > INITIAL_CHILD_ROWS ? prev.slice(0, -1) : prev));

  return {
    partner,
    children,
    updatePartner,
    updateChild,
    addChild,
    removeLastChild,
    proofDialogOpen,
    setProofDialogOpen,
  };
}

export type FamilyMembers = ReturnType<typeof useFamilyMembers>;
