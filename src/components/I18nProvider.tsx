"use client";

import { createContext, use, useMemo, type ReactNode } from "react";

import { makeT, type Dict, type T } from "@/lib/i18n";

/**
 * The dictionary, for client components.
 *
 * Server components call getT() and are done. Client components cannot — a
 * function does not cross that boundary — so the dictionary crosses as a plain
 * object once, here in the root layout, instead of being threaded through
 * every form's props. Twelve forms would otherwise each need a `dict` prop
 * passed down by a parent that has no other reason to know about language.
 *
 * The value is empty for Vietnamese, so the cost of this on the default path
 * is an empty object in the RSC payload.
 */

const I18nContext = createContext<Dict>({});

export function I18nProvider({
  dict,
  children,
}: {
  dict: Dict;
  children: ReactNode;
}) {
  return <I18nContext value={dict}>{children}</I18nContext>;
}

export function useT(): T {
  const dict = use(I18nContext);
  return useMemo(() => makeT(dict), [dict]);
}
