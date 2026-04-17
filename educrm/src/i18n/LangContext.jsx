import { createContext, useContext, useState } from "react";
import { TRANSLATIONS } from "./translations";

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState("uz");
  const t = TRANSLATIONS[lang];
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
