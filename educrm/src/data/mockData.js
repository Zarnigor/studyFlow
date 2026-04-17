/**
 * mockData.js — faqat UI uchun kerakli statik ma'lumotlar.
 * Real ma'lumotlar API dan keladi (src/api/client.js).
 */

// ── Avatar rang palitralari ───────────────────────────────────
// ID bo'yicha rang tanlash: AVA_PALETTES[id % AVA_PALETTES.length]
export const AVA_PALETTES = [
  { bg: "#E1F5EE", tc: "#085041" },
  { bg: "#E6F1FB", tc: "#0C447C" },
  { bg: "#FAEEDA", tc: "#633806" },
  { bg: "#EEEDFE", tc: "#3C3489" },
  { bg: "#FBEAF0", tc: "#72243E" },
  { bg: "#EAF3DE", tc: "#27500A" },
  { bg: "#FCEBEB", tc: "#791F1F" },
  { bg: "#9FE1CB", tc: "#04342C" },
];

// ── Lead kanban ustun ranglari ────────────────────────────────
export const STAGE_COLORS = [
  { bg: "#E6F1FB", tc: "#0C447C" }, // new
  { bg: "#EEEDFE", tc: "#3C3489" }, // called
  { bg: "#FAEEDA", tc: "#633806" }, // trial
  { bg: "#E1F5EE", tc: "#085041" }, // enrolled
  { bg: "#FCEBEB", tc: "#791F1F" }, // rejected
];

// ── Lead manba ranglari ───────────────────────────────────────
export const SOURCE_COLORS = {
  instagram:      { bg: "#EEEDFE", tc: "#3C3489" },
  telegram:       { bg: "#E6F1FB", tc: "#0C447C" },
  "Do'st orqali": { bg: "#E1F5EE", tc: "#085041" },
  referral:       { bg: "#E1F5EE", tc: "#085041" },
  reklama:        { bg: "#FAEEDA", tc: "#633806" },
  advertisement:  { bg: "#FAEEDA", tc: "#633806" },
  sayt:           { bg: "#FCEBEB", tc: "#791F1F" },
  website:        { bg: "#FCEBEB", tc: "#791F1F" },
  walk_in:        { bg: "#EAF3DE", tc: "#27500A" },
  other:          { bg: "var(--color-background-secondary)", tc: "var(--color-text-secondary)" },
};

// ── Kurslar (form select uchun) ───────────────────────────────
export const COURSES = [
  "English Starter", "English B1", "English B2",
  "IELTS Prep", "Math Advanced", "Russian A1", "IT Basics",
];
