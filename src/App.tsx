"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Circle,
  Download,
  Eraser,
  FileUp,
  Flag,
  Flame,
  Highlighter,
  LayoutDashboard,
  Menu,
  NotebookPen,
  PenTool,
  Plus,
  RotateCcw,
  Search,
  Spline,
  Square,
  Sparkles,
  Strikethrough,
  Target,
  Trash2,
  Underline,
  Upload,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import { ChangeEvent, CSSProperties, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

type Practice = "NP1" | "NP2" | "NP3" | "NP4" | "NP5";
type Letter = "A" | "B" | "C" | "D";
type View = "dashboard" | "practice" | "bank" | "vault" | "import";
type AnnotationColor = "yellow" | "red" | "blue" | "green";
type PenMode = "draw" | "underline" | "circle" | "box" | "strike" | "scribble" | "erase";
type ExamTool = "highlight" | "pen" | null;
type Confidence = "sure" | "unsure" | "guessing" | null;
type Point = { x: number; y: number };
type MarkPath = { id: string; tool: "pen" | "highlight"; kind: Exclude<PenMode, "erase">; color: AnnotationColor; d: string; start: Point; end: Point };
type TextPenMark = { id: string; mode: Exclude<PenMode, "draw" | "erase">; color: AnnotationColor; start: number; end: number };
type PdfCandidate = Omit<Question, "id" | "np" | "subject" | "source"> & { id: string; answerDetected: boolean; sourcePage?: number };

type Question = {
  id: string;
  np: Practice;
  subject: string;
  topic: string;
  situation?: string;
  stem: string;
  choices: Record<Letter, string>;
  correct: Letter;
  rationales: Partial<Record<Letter, string>>;
  source: "sample" | "imported";
};

type Attempt = {
  id: string;
  questionId: string;
  selected: Letter;
  correct: boolean;
  at: string;
};

const LETTERS: Letter[] = ["A", "B", "C", "D"];
const PRACTICES: Practice[] = ["NP1", "NP2", "NP3", "NP4", "NP5"];
const ANNOTATION_COLORS: Record<AnnotationColor, { label: string; ink: string; highlight: string }> = {
  yellow: { label: "Yellow", ink: "#d59b18", highlight: "rgba(244, 216, 63, .62)" },
  red: { label: "Red", ink: "#c45b58", highlight: "rgba(236, 126, 126, .48)" },
  blue: { label: "Blue", ink: "#3e83be", highlight: "rgba(104, 177, 233, .47)" },
  green: { label: "Green", ink: "#328d6d", highlight: "rgba(101, 191, 145, .46)" },
};

const sampleQuestions: Question[] = []; /* Built-in samples intentionally disabled: each student builds this bank from their own uploads.
  {
    id: "sample-np1-001",
    np: "NP1",
    subject: "Community Health Nursing",
    topic: "Epidemiology",
    situation:
      "A community health nurse is reviewing weekly dengue surveillance data from three barangays.",
    stem: "Which measure best describes the number of new dengue cases that developed during the week?",
    choices: {
      A: "Prevalence",
      B: "Incidence",
      C: "Case fatality rate",
      D: "Proportionate mortality rate",
    },
    correct: "B",
    rationales: {
      A: "Prevalence includes all existing cases at a specified time, not only newly developed cases.",
      B: "Incidence measures new cases occurring in a population at risk during a defined period.",
      C: "Case fatality rate measures the proportion of diagnosed cases that result in death.",
      D: "Proportionate mortality compares deaths from one cause with all deaths.",
    },
    source: "sample",
  },
  {
    id: "sample-np1-002",
    np: "NP1",
    subject: "Community Health Nursing",
    topic: "Primary Health Care",
    stem: "Which action best demonstrates community participation in primary health care?",
    choices: {
      A: "The nurse independently selects the barangay health priorities",
      B: "Residents help identify problems and plan local interventions",
      C: "The municipal office distributes a standard program to every barangay",
      D: "A hospital specialist conducts a one-time outreach clinic",
    },
    correct: "B",
    rationales: {
      A: "Professional direction without resident involvement does not demonstrate participation.",
      B: "Community participation means people help identify needs, decide priorities, and act on solutions.",
      C: "A centrally imposed program may not reflect locally identified needs.",
      D: "Outreach can improve access, but a one-time specialist visit does not by itself show participation.",
    },
    source: "sample",
  },
  {
    id: "sample-np1-003",
    np: "NP1",
    subject: "Fundamentals of Nursing",
    topic: "Infection Prevention",
    stem: "After removing gloves used for wound care, what should the nurse do next?",
    choices: {
      A: "Document the wound appearance",
      B: "Perform hand hygiene",
      C: "Put on a clean pair of gloves",
      D: "Disinfect the bedside table",
    },
    correct: "B",
    rationales: {
      A: "Documentation is important but follows immediate infection-control measures.",
      B: "Gloves do not replace hand hygiene; hands must be cleaned immediately after glove removal.",
      C: "New gloves are only needed for another indicated task and after hand hygiene.",
      D: "Environmental cleaning may be appropriate, but hand hygiene comes first.",
    },
    source: "sample",
  },
  {
    id: "sample-np2-001",
    np: "NP2",
    subject: "Maternal and Child Nursing",
    topic: "Intrapartum Care",
    situation:
      "A laboring client receiving oxytocin has six contractions in 10 minutes. Each contraction lasts 95 seconds.",
    stem: "What is the nurse's priority action?",
    choices: {
      A: "Increase the oxytocin rate",
      B: "Discontinue the oxytocin infusion",
      C: "Encourage the client to push",
      D: "Perform a vaginal examination",
    },
    correct: "B",
    rationales: {
      A: "Increasing oxytocin would worsen uterine tachysystole and fetal oxygen compromise.",
      B: "The pattern indicates tachysystole; stopping oxytocin removes the uterine stimulant first.",
      C: "Pushing is not indicated unless the cervix is fully dilated and may increase fetal stress.",
      D: "Assessment may follow, but it does not remove the immediate cause of excessive contractions.",
    },
    source: "sample",
  },
  {
    id: "sample-np2-002",
    np: "NP2",
    subject: "Pediatric Nursing",
    topic: "Growth and Development",
    stem: "Which play behavior is expected in a healthy 2-year-old child?",
    choices: {
      A: "Cooperative play with shared goals",
      B: "Competitive play with fixed rules",
      C: "Parallel play beside another child",
      D: "Team play with assigned roles",
    },
    correct: "C",
    rationales: {
      A: "Cooperative play develops later in the preschool years.",
      B: "Rule-based competitive play is more typical of school-age children.",
      C: "Toddlers commonly play beside other children with limited interaction, called parallel play.",
      D: "Organized team play requires later social and cognitive development.",
    },
    source: "sample",
  },
  {
    id: "sample-np2-003",
    np: "NP2",
    subject: "Maternal and Child Nursing",
    topic: "Postpartum Care",
    stem: "A postpartum client's uterus is boggy and displaced to the right. Which action should the nurse take first?",
    choices: {
      A: "Assist the client to empty her bladder",
      B: "Prepare the client for surgery",
      C: "Administer an opioid analgesic",
      D: "Place the client in Trendelenburg position",
    },
    correct: "A",
    rationales: {
      A: "A full bladder can displace the uterus and prevent effective contraction; bladder emptying addresses the likely cause.",
      B: "Surgery is not the initial response to a likely bladder-related uterine atony.",
      C: "Analgesia does not correct the cause of the boggy, displaced uterus.",
      D: "Trendelenburg positioning does not restore uterine tone or empty the bladder.",
    },
    source: "sample",
  },
  {
    id: "sample-np3-001",
    np: "NP3",
    subject: "Medical-Surgical Nursing",
    topic: "Gastrointestinal Disorders",
    situation:
      "A client is admitted with hematemesis, dizziness, blood pressure of 86/54 mmHg, and pulse of 122/min.",
    stem: "Which nursing action has the highest priority?",
    choices: {
      A: "Obtain a detailed dietary history",
      B: "Establish large-bore intravenous access",
      C: "Teach the client about proton pump inhibitors",
      D: "Collect a stool specimen for occult blood",
    },
    correct: "B",
    rationales: {
      A: "History-taking is deferred while the client shows signs of hypovolemic shock.",
      B: "Rapid vascular access is essential for fluid and blood replacement in an unstable GI bleed.",
      C: "Teaching is inappropriate during hemodynamic instability.",
      D: "The active upper GI bleed is already evident; circulation takes priority.",
    },
    source: "sample",
  },
  {
    id: "sample-np3-002",
    np: "NP3",
    subject: "Medical-Surgical Nursing",
    topic: "Neurologic Disorders",
    stem: "Which finding is an early indicator of increasing intracranial pressure?",
    choices: {
      A: "Change in level of consciousness",
      B: "Fixed and dilated pupils",
      C: "Decerebrate posturing",
      D: "Widened pulse pressure with bradycardia",
    },
    correct: "A",
    rationales: {
      A: "A subtle change in consciousness is often the earliest and most sensitive sign of rising ICP.",
      B: "Fixed pupils are a late, ominous finding associated with severe compression.",
      C: "Abnormal posturing indicates advanced neurologic deterioration.",
      D: "This Cushing response is a late sign of significantly increased ICP.",
    },
    source: "sample",
  },
  {
    id: "sample-np3-003",
    np: "NP3",
    subject: "Medical-Surgical Nursing",
    topic: "Respiratory Disorders",
    stem: "A client with COPD is receiving oxygen at 2 L/min by nasal cannula. Which finding requires immediate action?",
    choices: {
      A: "Barrel-shaped chest",
      B: "Diminished breath sounds",
      C: "Increasing drowsiness and confusion",
      D: "Chronic productive cough",
    },
    correct: "C",
    rationales: {
      A: "A barrel chest is a chronic structural finding in COPD.",
      B: "Diminished breath sounds may be expected with chronic airflow limitation.",
      C: "New drowsiness and confusion may indicate worsening hypoxemia or hypercapnia and needs urgent assessment.",
      D: "A chronic cough is common; a sudden change would be more concerning.",
    },
    source: "sample",
  },
  {
    id: "sample-np4-001",
    np: "NP4",
    subject: "Psychiatric Nursing",
    topic: "Therapeutic Communication",
    situation: "A client says, “The voices keep telling me that I am worthless.”",
    stem: "Which response by the nurse is most therapeutic?",
    choices: {
      A: "The voices are not real, so try to ignore them.",
      B: "What are the voices saying to you right now?",
      C: "Why do you think you hear those voices?",
      D: "Other clients hear voices too, so you are not alone.",
    },
    correct: "B",
    rationales: {
      A: "Arguing about the reality of hallucinations may reduce trust and misses a safety assessment.",
      B: "Exploring the content assesses risk, especially for command hallucinations, while accepting the client's experience.",
      C: "A 'why' question can feel judgmental and does not assess immediate safety.",
      D: "Generalizing minimizes the client's current distress.",
    },
    source: "sample",
  },
  {
    id: "sample-np4-002",
    np: "NP4",
    subject: "Psychiatric Nursing",
    topic: "Mood Disorders",
    stem: "Which intervention is most appropriate for a client in an acute manic episode?",
    choices: {
      A: "Provide high-calorie finger foods and fluids",
      B: "Encourage participation in competitive group games",
      C: "Offer lengthy discussions about behavior",
      D: "Allow unlimited physical activity without rest periods",
    },
    correct: "A",
    rationales: {
      A: "Finger foods support nutrition when hyperactivity makes sitting for meals difficult.",
      B: "Competitive activities can increase stimulation, agitation, and conflict.",
      C: "Short, clear communication is more effective during acute mania.",
      D: "Structured rest is needed to reduce exhaustion and physiologic stress.",
    },
    source: "sample",
  },
  {
    id: "sample-np4-003",
    np: "NP4",
    subject: "Psychiatric Nursing",
    topic: "Psychopharmacology",
    stem: "A client taking lithium reports diarrhea, coarse hand tremors, and unsteady gait. What should the nurse do first?",
    choices: {
      A: "Reassure the client that the effects are temporary",
      B: "Withhold the next dose and notify the prescriber",
      C: "Encourage the client to restrict sodium",
      D: "Give the medication with an antacid",
    },
    correct: "B",
    rationales: {
      A: "The cluster suggests toxicity rather than expected transient effects.",
      B: "The medication should be withheld and the prescriber notified because neurologic and GI signs suggest lithium toxicity.",
      C: "Sodium restriction can increase lithium retention and worsen toxicity.",
      D: "An antacid does not treat lithium toxicity.",
    },
    source: "sample",
  },
  {
    id: "sample-np5-001",
    np: "NP5",
    subject: "Nursing Leadership",
    topic: "Delegation",
    stem: "Which task is most appropriate for the nurse to delegate to an experienced nursing assistant?",
    choices: {
      A: "Assess a client reporting new chest pain",
      B: "Teach a newly diagnosed client to use a glucometer",
      C: "Obtain routine vital signs from a stable client",
      D: "Evaluate pain relief after IV morphine",
    },
    correct: "C",
    rationales: {
      A: "Assessment of a new symptom requires nursing judgment and cannot be delegated.",
      B: "Initial teaching is a registered nurse responsibility.",
      C: "Routine data collection for a stable client is predictable and within the assistant's role.",
      D: "Evaluation of a client's response to medication requires nursing judgment.",
    },
    source: "sample",
  },
  {
    id: "sample-np5-002",
    np: "NP5",
    subject: "Nursing Research",
    topic: "Research Ethics",
    stem: "Which ethical principle is primarily protected when a participant freely decides whether to join a study after receiving complete information?",
    choices: {
      A: "Justice",
      B: "Autonomy",
      C: "Beneficence",
      D: "Fidelity",
    },
    correct: "B",
    rationales: {
      A: "Justice concerns fairness in distributing research burdens and benefits.",
      B: "Voluntary informed consent protects the participant's right to self-determination or autonomy.",
      C: "Beneficence requires maximizing benefit and minimizing harm.",
      D: "Fidelity concerns keeping commitments and maintaining trust.",
    },
    source: "sample",
  },
  {
    id: "sample-np5-003",
    np: "NP5",
    subject: "Nursing Leadership",
    topic: "Prioritization",
    stem: "Which client should the charge nurse assess first?",
    choices: {
      A: "A postoperative client requesting pain medication for pain rated 7/10",
      B: "A client with pneumonia whose oxygen saturation dropped from 95% to 88%",
      C: "A client with diabetes awaiting discharge teaching",
      D: "A client with a cast reporting itching under the cast",
    },
    correct: "B",
    rationales: {
      A: "Pain requires treatment, but it is not the most immediate threat among these findings.",
      B: "An acute drop in oxygen saturation signals impaired breathing and takes priority under ABCs.",
      C: "Discharge teaching can safely wait while an unstable client is assessed.",
      D: "Itching is common with a cast unless accompanied by signs of neurovascular compromise.",
    },
    source: "sample",
  },
]; */

const previewScores: Record<Practice, number> = {
  NP1: 82,
  NP2: 61,
  NP3: 73,
  NP4: 88,
  NP5: 68,
};

const previewTopics = [
  { topic: "Intrapartum Care", np: "NP2", score: 56, attempts: 9 },
  { topic: "Prioritization", np: "NP5", score: 63, attempts: 8 },
  { topic: "Respiratory Disorders", np: "NP3", score: 67, attempts: 6 },
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeKey(key: string) {
  return key.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function pick(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[normalizeKey(key)];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function normalizeImported(records: Record<string, unknown>[]): Question[] {
  return records.map((raw, index) => {
    const record = Object.fromEntries(Object.entries(raw).map(([key, value]) => [normalizeKey(key), value]));
    const np = pick(record, "np", "nursing_practice", "practice").toUpperCase() as Practice;
    const correct = pick(record, "answer", "correct", "correct_answer").toUpperCase() as Letter;
    const choicesFromArray = Array.isArray(record.choices) ? record.choices.map(String) : null;
    const choices: Record<Letter, string> = {
      A: choicesFromArray?.[0] ?? pick(record, "option_a", "choice_a", "a"),
      B: choicesFromArray?.[1] ?? pick(record, "option_b", "choice_b", "b"),
      C: choicesFromArray?.[2] ?? pick(record, "option_c", "choice_c", "c"),
      D: choicesFromArray?.[3] ?? pick(record, "option_d", "choice_d", "d"),
    };
    const stem = pick(record, "question", "stem", "question_text");
    const subject = pick(record, "subject") || "General Nursing";
    const topic = pick(record, "topic") || subject;

    if (!PRACTICES.includes(np) || !LETTERS.includes(correct) || !stem || LETTERS.some((letter) => !choices[letter])) {
      throw new Error(`Row ${index + 1} is missing a valid NP1–NP5 label, question, four choices, or A–D answer.`);
    }

    const generalRationale = pick(record, "rationale", "explanation");
    return {
      id: `imported-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      np,
      subject,
      topic,
      situation: pick(record, "situation", "case", "scenario") || undefined,
      stem,
      choices,
      correct,
      rationales: {
        A: pick(record, "rationale_a") || (correct === "A" ? generalRationale : ""),
        B: pick(record, "rationale_b") || (correct === "B" ? generalRationale : ""),
        C: pick(record, "rationale_c") || (correct === "C" ? generalRationale : ""),
        D: pick(record, "rationale_d") || (correct === "D" ? generalRationale : ""),
      },
      source: "imported",
    };
  });
}

function parseImport(text: string): Question[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Add a file or paste questions first.");
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const records = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(records)) throw new Error("JSON must be an array of questions or contain a questions array.");
    return normalizeImported(records);
  }
  const firstLine = trimmed.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const rows = parseDelimited(trimmed, delimiter);
  if (rows.length < 2) throw new Error("The file needs a header row and at least one question.");
  const headers = rows[0].map(normalizeKey);
  const records = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  return normalizeImported(records);
}

function suggestPdfCategory(text: string): { np: Practice; subject: string; topic: string } {
  const value = text.toLowerCase();
  if (/(barangay|community|epidemiolog|doh|tuberculosis|home visit|primary health)/.test(value)) return { np: "NP1", subject: "Community Health Nursing", topic: "Community Health Nursing" };
  if (/(labor|postpartum|pregnan|neonat|pediatric|child)/.test(value)) return { np: "NP2", subject: "Maternal and Child Nursing", topic: "Maternal and Child Nursing" };
  if (/(research|sampling|hypothesis|leadership|delegat|management)/.test(value)) return { np: "NP5", subject: "Nursing Research", topic: "Nursing Research" };
  if (/(psychiatr|mental health|therapeutic communication)/.test(value)) return { np: "NP4", subject: "Psychiatric Nursing", topic: "Psychiatric Nursing" };
  return { np: "NP3", subject: "Medical-Surgical Nursing", topic: "Medical-Surgical Nursing" };
}

function textContentToPdfLines(items: unknown[]): string {
  type PositionedItem = { str: string; x: number; y: number };
  const positioned = items.flatMap((item): PositionedItem[] => {
    if (!item || typeof item !== "object" || !("str" in item) || typeof item.str !== "string" || !item.str.trim()) return [];
    const transform = "transform" in item && Array.isArray(item.transform) ? item.transform : [];
    return [{ str: item.str.trim(), x: Number(transform[4]) || 0, y: Number(transform[5]) || 0 }];
  });
  if (!positioned.length) return "";
  const xs = positioned.map((item) => item.x);
  const splitAt = (Math.min(...xs) + Math.max(...xs)) / 2;
  const columns = Math.max(...xs) - Math.min(...xs) > 260 ? [positioned.filter((item) => item.x < splitAt), positioned.filter((item) => item.x >= splitAt)] : [positioned];
  return columns.map((column) => {
    const lines = new Map<number, PositionedItem[]>();
    column.forEach((item) => {
      const key = Math.round(item.y / 3) * 3;
      lines.set(key, [...(lines.get(key) || []), item]);
    });
    return [...lines.entries()].sort(([a], [b]) => b - a).map(([, line]) => line.sort((a, b) => a.x - b.x).map((item) => item.str).join(" ").replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  }).filter(Boolean).join("\n\n");
}

function pdfCandidateIssue(candidate: PdfCandidate): string | null {
  if (!candidate.stem.trim()) return "The question text is missing.";
  if (LETTERS.some((letter) => !candidate.choices[letter]?.trim())) return "One or more answer choices are missing.";
  const finalChoice = candidate.choices.D;
  if (finalChoice.length > 260 || /\b(?:difficulty|rationale|answer\s*key|explanation)\b/i.test(finalChoice) || /\bA\s+B\s+C\s+D\b/i.test(finalChoice)) {
    return "Choice D may include answer-key or rationale text. Edit and verify it before importing.";
  }
  return null;
}

function parsePdfCandidates(text: string): PdfCandidate[] {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  const matches = [...normalized.matchAll(/(?:^|\n)\s*(\d{1,3})\.\s+([\s\S]*?)(?=\n\s*\d{1,3}\.\s+|$)/g)];
  let latestSituation = "";
  const candidates: Array<PdfCandidate | null> = matches.map((match, index) => {
    const block = match[0];
    const before = normalized.slice(0, match.index);
    const situations = [...before.matchAll(/(?:^|\n)\s*SITUATION\s+\d+\s*[-–:]?\s*([\s\S]*?)(?=\n\s*\d{1,3}\.\s+)/gi)];
    if (situations.length) latestSituation = situations[situations.length - 1][1].replace(/\s+/g, " ").trim();
    const optionMatches = [...block.matchAll(/(?:^|\n)\s*([a-dA-D])\.\s*([\s\S]*?)(?=\n\s*[a-dA-D]\.\s*|$)/g)];
    if (optionMatches.length < 4) return null;
    const firstOption = optionMatches[0].index ?? block.length;
    const stem = block.slice(0, firstOption).replace(/^\s*\d{1,3}\.\s*/, "").replace(/\s+/g, " ").trim();
    const choices = {} as Record<Letter, string>;
    optionMatches.slice(0, 4).forEach((option) => { choices[option[1].toUpperCase() as Letter] = option[2].replace(/\s+/g, " ").trim(); });
    const feedback = optionMatches.slice(4).map((option) => `${option[1]}. ${option[2]}`).join(" ");
    const explicit = feedback.match(/\b([A-D])\.\s*(?:correct answer|correct\b)/i);
    const correct = (explicit?.[1]?.toUpperCase() || "A") as Letter;
    const rationales = {} as Partial<Record<Letter, string>>;
    [...feedback.matchAll(/\b([A-D])\.\s*([\s\S]*?)(?=\s+[A-D]\.|$)/gi)].forEach((note) => { rationales[note[1].toUpperCase() as Letter] = note[2].replace(/\s+/g, " ").trim(); });
    return { id: `pdf-${index}`, situation: latestSituation || undefined, stem, choices, correct, rationales, topic: "", answerDetected: Boolean(explicit) };
  });
  return candidates.filter((item): item is PdfCandidate => Boolean(item && item.stem && LETTERS.every((letter) => item.choices[letter])));
}

function scoreTone(score: number) {
  if (score >= 80) return "strong";
  if (score >= 65) return "steady";
  return "focus";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(new Date(value));
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [imported, setImported] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [vaultIds, setVaultIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<Letter | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [practiceNp, setPracticeNp] = useState<Practice | "All">("All");
  const [practiceSubject, setPracticeSubject] = useState("All subjects");
  const [bankQuery, setBankQuery] = useState("");
  const [bankNp, setBankNp] = useState<Practice | "All">("All");
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [importGuideOpen, setImportGuideOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState<string | null>(null);
  const [pdfCandidates, setPdfCandidates] = useState<PdfCandidate[]>([]);
  const [batchNp, setBatchNp] = useState<Practice>("NP1");
  const [batchSubject, setBatchSubject] = useState("Community Health Nursing");
  const [batchTopic, setBatchTopic] = useState("Community Health Nursing");
  const [pdfFileName, setPdfFileName] = useState("");
  const [examTool, setExamTool] = useState<ExamTool>(null);
  const [highlightColor, setHighlightColor] = useState<AnnotationColor>("yellow");
  const [penColor, setPenColor] = useState<AnnotationColor>("blue");
  const [penMode, setPenMode] = useState<PenMode>("underline");
  const [xSide, setXSide] = useState<"left" | "right">("right");
  const [eliminated, setEliminated] = useState<Record<string, Letter[]>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<Record<string, Confidence>>({});
  const [markings, setMarkings] = useState<Record<string, MarkPath[]>>({});
  const [highlighted, setHighlighted] = useState<Record<string, Record<string, AnnotationColor>>>({});
  const [textPenMarks, setTextPenMarks] = useState<Record<string, TextPenMark[]>>({});
  const [scratchNotes, setScratchNotes] = useState<Record<string, string>>({});
  const [scratchMarks, setScratchMarks] = useState<Record<string, MarkPath[]>>({});
  const [scratchMode, setScratchMode] = useState<"draw" | "type">("type");
  const [scratchTool, setScratchTool] = useState<"pen" | "highlight" | "erase">("pen");
  const [scratchColor, setScratchColor] = useState<AnnotationColor>("blue");
  const [scratchOpen, setScratchOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const markingLayerRef = useRef<SVGSVGElement>(null);
  const scratchLayerRef = useRef<SVGSVGElement>(null);
  const drawingIdRef = useRef<string | null>(null);
  const drawingStartRef = useRef<Point | null>(null);
  const activeTextPenRef = useRef<string | null>(null);
  const scratchDrawingIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const savedQuestions = JSON.parse(localStorage.getItem("pnle-imported-questions") || "[]");
      const savedAttempts = JSON.parse(localStorage.getItem("pnle-attempts") || "[]");
      const savedVault = JSON.parse(localStorage.getItem("pnle-vault") || "[]");
      const savedFlags = JSON.parse(localStorage.getItem("pnle-flagged") || "[]");
      const savedScratch = JSON.parse(localStorage.getItem("pnle-scratch-notes") || "{}");
      const savedScratchMarks = JSON.parse(localStorage.getItem("pnle-scratch-marks") || "{}");
      if (Array.isArray(savedQuestions)) setImported(savedQuestions);
      if (Array.isArray(savedAttempts)) setAttempts(savedAttempts);
      if (Array.isArray(savedVault)) setVaultIds(savedVault);
      if (Array.isArray(savedFlags)) setFlagged(savedFlags);
      if (savedScratch && typeof savedScratch === "object") setScratchNotes(savedScratch);
      if (savedScratchMarks && typeof savedScratchMarks === "object") setScratchMarks(savedScratchMarks);
    } catch {
      localStorage.removeItem("pnle-imported-questions");
      localStorage.removeItem("pnle-attempts");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const stopTextPen = () => { activeTextPenRef.current = null; };
    window.addEventListener("pointerup", stopTextPen);
    return () => window.removeEventListener("pointerup", stopTextPen);
  }, []);

  const questions = useMemo(() => [...sampleQuestions, ...imported], [imported]);
  const questionById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
  const subjects = useMemo(() => [...new Set(questions.map((question) => question.subject))].sort(), [questions]);
  const filteredPractice = useMemo(
    () =>
      questions.filter(
        (question) =>
          (practiceNp === "All" || question.np === practiceNp) &&
          (practiceSubject === "All subjects" || question.subject === practiceSubject),
      ),
    [practiceNp, practiceSubject, questions],
  );
  const currentQuestion = filteredPractice[questionIndex % Math.max(filteredPractice.length, 1)];
  const currentQuestionPosition = questionIndex % Math.max(filteredPractice.length, 1);
  const currentEliminated = currentQuestion ? eliminated[currentQuestion.id] || [] : [];
  const currentMarkings = currentQuestion ? markings[currentQuestion.id] || [] : [];
  const currentHighlights = currentQuestion ? highlighted[currentQuestion.id] || {} : {};
  const currentTextPenMarks = currentQuestion ? textPenMarks[currentQuestion.id] || [] : [];
  const currentScratchMarks = currentQuestion ? scratchMarks[currentQuestion.id] || [] : [];
  const pdfIssues = useMemo(() => pdfCandidates.flatMap((candidate, index) => {
    const issue = pdfCandidateIssue(candidate);
    return issue ? [{ index, issue }] : [];
  }), [pdfCandidates]);

  const actualScores = useMemo(() => {
    const result = {} as Record<Practice, number>;
    PRACTICES.forEach((np) => {
      const npAttempts = attempts.filter((attempt) => questionById.get(attempt.questionId)?.np === np);
      result[np] = npAttempts.length
        ? clampScore((npAttempts.filter((attempt) => attempt.correct).length / npAttempts.length) * 100)
        : 0;
    });
    return result;
  }, [attempts, questionById]);

  const topicStats = useMemo(() => {
    const grouped = new Map<string, { correct: number; attempts: number; np: Practice }>();
    attempts.forEach((attempt) => {
      const question = questionById.get(attempt.questionId);
      if (!question) return;
      const current = grouped.get(question.topic) || { correct: 0, attempts: 0, np: question.np };
      current.attempts += 1;
      if (attempt.correct) current.correct += 1;
      grouped.set(question.topic, current);
    });
    return [...grouped.entries()]
      .map(([topic, value]) => ({
        topic,
        np: value.np,
        score: clampScore((value.correct / value.attempts) * 100),
        attempts: value.attempts,
      }))
      .sort((a, b) => a.score - b.score || b.attempts - a.attempts);
  }, [attempts, questionById]);

  const hasPerformance = attempts.length > 0;
  const displayedScores = actualScores;
  const attentionTopics = hasPerformance && topicStats.length ? topicStats.slice(0, 3) : [];
  const accuracy = attempts.length
    ? clampScore((attempts.filter((attempt) => attempt.correct).length / attempts.length) * 100)
    : 0;
  const vaultQuestions = useMemo(() => vaultIds.map((id) => questionById.get(id)).filter((question): question is Question => Boolean(question)), [vaultIds, questionById]);
  const strongestTopic = hasPerformance && topicStats.length ? [...topicStats].sort((a, b) => b.score - a.score || b.attempts - a.attempts)[0] : null;
  const focusTopic = hasPerformance && topicStats.length ? topicStats[0] : null;

  const bankQuestions = useMemo(() => {
    const query = bankQuery.toLowerCase().trim();
    return questions.filter(
      (question) =>
        (bankNp === "All" || question.np === bankNp) &&
        (!query ||
          question.stem.toLowerCase().includes(query) ||
          question.subject.toLowerCase().includes(query) ||
          question.topic.toLowerCase().includes(query)),
    );
  }, [bankNp, bankQuery, questions]);

  function navigate(next: View) {
    setView(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startPractice(np: Practice | "All" = "All") {
    setPracticeNp(np);
    setPracticeSubject("All subjects");
    setQuestionIndex(0);
    setSelected(null);
    setRevealed(false);
    navigate("practice");
  }

  function checkAnswer() {
    if (!currentQuestion || !selected || revealed) return;
    const attempt: Attempt = {
      id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      questionId: currentQuestion.id,
      selected,
      correct: selected === currentQuestion.correct,
      at: new Date().toISOString(),
    };
    const nextAttempts = [attempt, ...attempts];
    setAttempts(nextAttempts);
    localStorage.setItem("pnle-attempts", JSON.stringify(nextAttempts));
    if (!attempt.correct && !vaultIds.includes(currentQuestion.id)) {
      const nextVault = [currentQuestion.id, ...vaultIds];
      setVaultIds(nextVault);
      localStorage.setItem("pnle-vault", JSON.stringify(nextVault));
    }
    setRevealed(true);
  }

  function removeFromVault(id: string) {
    const nextVault = vaultIds.filter((questionId) => questionId !== id);
    setVaultIds(nextVault);
    localStorage.setItem("pnle-vault", JSON.stringify(nextVault));
  }

  function toggleEliminated(letter: Letter) {
    if (!currentQuestion || revealed) return;
    setEliminated((previous) => {
      const current = previous[currentQuestion.id] || [];
      return {
        ...previous,
        [currentQuestion.id]: current.includes(letter) ? current.filter((item) => item !== letter) : [...current, letter],
      };
    });
    if (selected === letter) setSelected(null);
  }

  function toggleFlag() {
    if (!currentQuestion) return;
    const next = flagged.includes(currentQuestion.id)
      ? flagged.filter((id) => id !== currentQuestion.id)
      : [...flagged, currentQuestion.id];
    setFlagged(next);
    localStorage.setItem("pnle-flagged", JSON.stringify(next));
  }

  function updateScratch(value: string) {
    if (!currentQuestion) return;
    const next = { ...scratchNotes, [currentQuestion.id]: value };
    setScratchNotes(next);
    localStorage.setItem("pnle-scratch-notes", JSON.stringify(next));
  }

  function pointOnLayer(event: ReactPointerEvent<SVGSVGElement>, layer: React.RefObject<SVGSVGElement | null>) {
    const rect = layer.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function markData(kind: Exclude<PenMode, "erase">, start: Point, end: Point, existing = "") {
    if (kind === "draw" || kind === "scribble") return existing ? `${existing} L ${end.x} ${end.y}` : `M ${start.x} ${start.y}`;
    if (kind === "underline") return `M ${start.x} ${end.y} L ${end.x} ${end.y}`;
    if (kind === "box") return `M ${start.x} ${start.y} H ${end.x} V ${end.y} H ${start.x} Z`;
    const rx = Math.max(5, Math.abs(end.x - start.x) / 2);
    const ry = Math.max(5, Math.abs(end.y - start.y) / 2);
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
  }

  function eraseAt(point: Point, marks: MarkPath[]) {
    return marks.filter((mark) => {
      const minX = Math.min(mark.start.x, mark.end.x) - 24;
      const maxX = Math.max(mark.start.x, mark.end.x) + 24;
      const minY = Math.min(mark.start.y, mark.end.y) - 24;
      const maxY = Math.max(mark.start.y, mark.end.y) + 24;
      return point.x < minX || point.x > maxX || point.y < minY || point.y > maxY;
    });
  }

  function startMark(event: ReactPointerEvent<SVGSVGElement>) {
    if (examTool !== "pen" || !currentQuestion) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointOnLayer(event, markingLayerRef);
    if (penMode === "erase") {
      setMarkings((previous) => ({ ...previous, [currentQuestion.id]: eraseAt(point, previous[currentQuestion.id] || []) }));
      return;
    }
    const id = `mark-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    drawingIdRef.current = id;
    drawingStartRef.current = point;
    setMarkings((previous) => ({
      ...previous,
      [currentQuestion.id]: [...(previous[currentQuestion.id] || []), { id, tool: "pen", kind: penMode, color: penColor, d: markData(penMode, point, point), start: point, end: point }],
    }));
  }

  function continueMark(event: ReactPointerEvent<SVGSVGElement>) {
    if (!currentQuestion) return;
    const point = pointOnLayer(event, markingLayerRef);
    if (penMode === "erase") {
      setMarkings((previous) => ({ ...previous, [currentQuestion.id]: eraseAt(point, previous[currentQuestion.id] || []) }));
      return;
    }
    if (!drawingIdRef.current || !drawingStartRef.current) return;
    const drawingId = drawingIdRef.current;
    const start = drawingStartRef.current;
    setMarkings((previous) => ({
      ...previous,
      [currentQuestion.id]: (previous[currentQuestion.id] || []).map((mark) =>
        mark.id === drawingId ? { ...mark, end: point, d: markData(mark.kind, start, point, mark.d) } : mark,
      ),
    }));
  }

  function stopMark() {
    drawingIdRef.current = null;
    drawingStartRef.current = null;
  }

  function clearMarks() {
    if (!currentQuestion) return;
    setMarkings((previous) => ({ ...previous, [currentQuestion.id]: [] }));
    setHighlighted((previous) => ({ ...previous, [currentQuestion.id]: {} }));
    setTextPenMarks((previous) => ({ ...previous, [currentQuestion.id]: [] }));
  }

  function toggleHighlight(tokenId: string) {
    if (!currentQuestion || examTool !== "highlight") return;
    setHighlighted((previous) => {
      const current = previous[currentQuestion.id] || {};
      return {
        ...previous,
        [currentQuestion.id]: current[tokenId]
          ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== tokenId))
          : { ...current, [tokenId]: highlightColor },
      };
    });
  }

  function textPosition(section: string, index: number) {
    const bases: Record<string, number> = { situation: 0, question: 1000, "choice-A": 2000, "choice-B": 3000, "choice-C": 4000, "choice-D": 5000 };
    return (bases[section] || 9000) + index;
  }

  function beginTextPen(event: ReactPointerEvent<HTMLSpanElement>, position: number) {
    if (!currentQuestion || examTool !== "pen") return;
    event.preventDefault();
    event.stopPropagation();
    if (penMode === "erase") {
      setTextPenMarks((previous) => ({
        ...previous,
        [currentQuestion.id]: (previous[currentQuestion.id] || []).filter((mark) => position < Math.min(mark.start, mark.end) || position > Math.max(mark.start, mark.end)),
      }));
      return;
    }
    if (penMode === "draw") return;
    const id = `text-mark-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    activeTextPenRef.current = id;
    setTextPenMarks((previous) => ({ ...previous, [currentQuestion.id]: [...(previous[currentQuestion.id] || []), { id, mode: penMode, color: penColor, start: position, end: position }] }));
  }

  function extendTextPen(event: ReactPointerEvent<HTMLSpanElement>, position: number) {
    if (!currentQuestion || !activeTextPenRef.current || examTool !== "pen" || penMode === "erase") return;
    event.preventDefault();
    const id = activeTextPenRef.current;
    setTextPenMarks((previous) => ({ ...previous, [currentQuestion.id]: (previous[currentQuestion.id] || []).map((mark) => mark.id === id ? { ...mark, end: position } : mark) }));
  }

  function renderHighlightText(text: string, section: string) {
    const activeHighlights = currentQuestion ? highlighted[currentQuestion.id] || {} : {};
    const parts = text.split(/(\s+)/);
    return parts.map((part, index) => {
      if (!part.trim()) return part;
      const tokenId = `${section}-${index}`;
      const color = activeHighlights[tokenId];
      const position = textPosition(section, index);
      const penMark = [...currentTextPenMarks].reverse().find((mark) => position >= Math.min(mark.start, mark.end) && position <= Math.max(mark.start, mark.end));
      const penStart = penMark && position === Math.min(penMark.start, penMark.end);
      const penEnd = penMark && position === Math.max(penMark.start, penMark.end);
      const markStart = penMark ? Math.min(penMark.start, penMark.end) : 0;
      const wordOffset = penMark ? Math.round((position - markStart) / 2) : 0;
      const isSegmentedMark = penMark?.mode === "circle" || penMark?.mode === "box";
      const penSegmentStart = isSegmentedMark && (Boolean(penStart) || wordOffset % 3 === 0);
      const penSegmentEnd = isSegmentedMark && (Boolean(penEnd) || wordOffset % 3 === 2);
      const segment = Math.floor(wordOffset / 3);
      const penTilt = [-0.55, 0.35, -0.2, 0.48][segment % 4];
      const penLift = [-0.3, 0.2, 0, -0.15][segment % 4];
      return (
        <span
          key={tokenId}
          className={`highlight-token ${color ? "is-highlighted" : ""} ${examTool === "highlight" ? "is-editable" : ""} ${penMark ? `text-pen pen-${penMark.mode} ${penStart ? "pen-start" : ""} ${penEnd ? "pen-end" : ""} ${penSegmentStart ? "pen-segment-start" : ""} ${penSegmentEnd ? "pen-segment-end" : ""}` : ""} ${examTool === "pen" ? "is-pen-editable" : ""}`}
          style={{ ...(color ? { backgroundColor: ANNOTATION_COLORS[color].highlight } : {}), ...(penMark ? { "--pen-ink": ANNOTATION_COLORS[penMark.color].ink, "--pen-tilt": `${penTilt}deg`, "--pen-lift": `${penLift}px` } : {}) } as CSSProperties}
          onPointerDown={(event) => beginTextPen(event, position)}
          onPointerEnter={(event) => extendTextPen(event, position)}
          onPointerUp={() => { activeTextPenRef.current = null; }}
          onClick={(event) => {
            if (examTool !== "highlight") return;
            event.stopPropagation();
            toggleHighlight(tokenId);
          }}
        >
          {part}{parts[index + 1] || ""}
        </span>
      );
    }).filter((part, index) => !parts[index].match(/^\s+$/));
  }

  function updateScratchMarks(next: Record<string, MarkPath[]>) {
    setScratchMarks(next);
    localStorage.setItem("pnle-scratch-marks", JSON.stringify(next));
  }

  function startScratchMark(event: ReactPointerEvent<SVGSVGElement>) {
    if (!currentQuestion || scratchMode !== "draw") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointOnLayer(event, scratchLayerRef);
    if (scratchTool === "erase") {
      updateScratchMarks({ ...scratchMarks, [currentQuestion.id]: eraseAt(point, currentScratchMarks) });
      return;
    }
    const id = `scratch-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    scratchDrawingIdRef.current = id;
    const mark: MarkPath = { id, tool: scratchTool, kind: "draw", color: scratchColor, d: `M ${point.x} ${point.y}`, start: point, end: point };
    updateScratchMarks({ ...scratchMarks, [currentQuestion.id]: [...currentScratchMarks, mark] });
  }

  function continueScratchMark(event: ReactPointerEvent<SVGSVGElement>) {
    if (!currentQuestion || scratchMode !== "draw") return;
    const point = pointOnLayer(event, scratchLayerRef);
    if (scratchTool === "erase") {
      updateScratchMarks({ ...scratchMarks, [currentQuestion.id]: eraseAt(point, currentScratchMarks) });
      return;
    }
    const id = scratchDrawingIdRef.current;
    if (!id) return;
    updateScratchMarks({
      ...scratchMarks,
      [currentQuestion.id]: currentScratchMarks.map((mark) => mark.id === id ? { ...mark, end: point, d: `${mark.d} L ${point.x} ${point.y}` } : mark),
    });
  }

  function stopScratchMark() {
    scratchDrawingIdRef.current = null;
  }

  function clearScratchPad() {
    if (!currentQuestion) return;
    updateScratch("");
    updateScratchMarks({ ...scratchMarks, [currentQuestion.id]: [] });
  }

  useEffect(() => {
    function handleExamKeys(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (view !== "practice" || target?.matches("input, textarea, select") || examTool) return;
      if (["1", "2", "3", "4"].includes(event.key) && currentQuestion && !revealed) {
        const letter = LETTERS[Number(event.key) - 1];
        if (!currentEliminated.includes(letter)) setSelected(letter);
      }
      if (event.code === "Space" && currentQuestion) {
        event.preventDefault();
        if (revealed) nextQuestion();
        else if (selected) checkAnswer();
      }
    }
    window.addEventListener("keydown", handleExamKeys);
    return () => window.removeEventListener("keydown", handleExamKeys);
    // The handler intentionally refreshes with current exam state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, examTool, currentQuestion, currentEliminated, revealed, selected, attempts, filteredPractice.length]);

  function nextQuestion() {
    setQuestionIndex((index) => (index + 1) % Math.max(filteredPractice.length, 1));
    setSelected(null);
    setRevealed(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousQuestion() {
    if (questionIndex <= 0) return;
    setQuestionIndex((index) => (index - 1 + Math.max(filteredPractice.length, 1)) % Math.max(filteredPractice.length, 1));
    setSelected(null);
    setRevealed(false);
  }

  function changePracticeFilter(np: Practice | "All") {
    setPracticeNp(np);
    setQuestionIndex(0);
    setSelected(null);
    setRevealed(false);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const content = await (await document.getPage(pageNumber)).getTextContent();
          pages.push(textContentToPdfLines(content.items));
        }
        const extracted = pages.join("\n");
        const candidates = parsePdfCandidates(extracted);
        if (!candidates.length) throw new Error("I could not find complete A–D questions in this PDF. Try a text-based PDF or import it as a CSV.");
        const suggestion = suggestPdfCategory(extracted);
        setPdfCandidates(candidates);
        setBatchNp(suggestion.np);
        setBatchSubject(suggestion.subject);
        setBatchTopic(suggestion.topic);
        setPdfFileName(file.name);
        setImportMessage({ type: "success", text: `${candidates.length} questions were extracted. Review the answer letters, then choose where this batch belongs.` });
      } catch (error) {
        setImportMessage({ type: "error", text: error instanceof Error ? error.message : "This PDF could not be read." });
      }
      return;
    }
    setPdfCandidates([]);
    setPdfFileName("");
    setImportText(await file.text());
    setImportMessage({ type: "success", text: `${file.name} is ready to review and import.` });
  }

  function importQuestions() {
    try {
      const parsed = parseImport(importText);
      const nextImported = [...imported, ...parsed];
      setImported(nextImported);
      localStorage.setItem("pnle-imported-questions", JSON.stringify(nextImported));
      setImportMessage({ type: "success", text: `${parsed.length} question${parsed.length === 1 ? "" : "s"} added to your bank.` });
      setImportText("");
    } catch (error) {
      setImportMessage({ type: "error", text: error instanceof Error ? error.message : "The questions could not be imported." });
    }
  }

  function importPdfBatch() {
    if (!pdfCandidates.length || pdfIssues.length) return;
    const batch = pdfCandidates.map((candidate, index): Question => ({
      id: `imported-pdf-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      np: batchNp,
      subject: batchSubject.trim() || "General Nursing",
      topic: batchTopic.trim() || batchSubject.trim() || "General Nursing",
      situation: candidate.situation,
      stem: candidate.stem,
      choices: candidate.choices,
      correct: candidate.correct,
      rationales: candidate.rationales,
      source: "imported",
    }));
    const nextImported = [...imported, ...batch];
    setImported(nextImported);
    localStorage.setItem("pnle-imported-questions", JSON.stringify(nextImported));
    setImportMessage({ type: "success", text: `${batch.length} PDF questions added under ${batchNp} · ${batchSubject}.` });
    setPdfCandidates([]);
    setPdfFileName("");
  }

  function updatePdfCandidate(index: number, field: "situation" | "stem" | Letter, value: string) {
    setPdfCandidates((items) => items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (field === "situation" || field === "stem") return { ...item, [field]: value };
      return { ...item, choices: { ...item.choices, [field]: value } };
    }));
  }

  function studyReadyRationale(candidate: PdfCandidate, letter: Letter) {
    const extracted = candidate.rationales[letter]?.trim();
    const choice = candidate.choices[letter]?.trim() || "This option";
    if (letter === candidate.correct) {
      return extracted
        ? `${extracted} This is the best answer because it directly addresses the priority and key cues in the question.`
        : `${choice} is the best answer because it most directly addresses the priority and key cues in this question.`;
    }
    return extracted
      ? `${extracted} This is not the best answer when compared with the priority identified in the question.`
      : `${choice} is not the best answer for this item. Compare it with the priority and clinical cues before selecting an option.`;
  }

  function fillPdfRationale(index: number, letter: Letter) {
    setPdfCandidates((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, rationales: { ...item.rationales, [letter]: studyReadyRationale(item, letter) } } : item));
  }

  function fillAllPdfRationales(index: number) {
    setPdfCandidates((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, rationales: Object.fromEntries(LETTERS.map((letter) => [letter, studyReadyRationale(item, letter)])) } : item));
  }

  function updatePdfRationale(index: number, letter: Letter, value: string) {
    setPdfCandidates((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, rationales: { ...item.rationales, [letter]: value } } : item));
  }

  async function generatePdfRationale(index: number, letter: Letter) {
    const candidate = pdfCandidates[index];
    if (!candidate) return;
    const requestId = `${index}-${letter}`;
    setAiGenerating(requestId);
    setImportMessage(null);
    try {
      const result = await fetch("/api/generate-rationale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation: candidate.situation,
          stem: candidate.stem,
          choices: candidate.choices,
          correct: candidate.correct,
          letter,
          extractedRationale: candidate.rationales[letter] || "",
        }),
      });
      const data = await result.json() as { rationale?: string; error?: string };
      if (!result.ok || !data.rationale) throw new Error(data.error || "AI rationale generation failed.");
      updatePdfRationale(index, letter, data.rationale);
      setImportMessage({ type: "success", text: `AI rationale created for choice ${letter}. Review it before importing.` });
    } catch (error) {
      setImportMessage({ type: "error", text: error instanceof Error ? error.message : "AI rationale generation failed." });
    } finally {
      setAiGenerating(null);
    }
  }

  function deleteImported(id: string) {
    const nextImported = imported.filter((question) => question.id !== id);
    const nextAttempts = attempts.filter((attempt) => attempt.questionId !== id);
    setImported(nextImported);
    setAttempts(nextAttempts);
    localStorage.setItem("pnle-imported-questions", JSON.stringify(nextImported));
    localStorage.setItem("pnle-attempts", JSON.stringify(nextAttempts));
    setSelectedImportIds((ids) => ids.filter((selectedId) => selectedId !== id));
  }

  function toggleImportedSelection(id: string) {
    setSelectedImportIds((ids) => ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id]);
  }

  function toggleVisibleImported() {
    const visibleIds = bankQuestions.filter((question) => question.source === "imported").map((question) => question.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedImportIds.includes(id));
    setSelectedImportIds((ids) => allSelected ? ids.filter((id) => !visibleIds.includes(id)) : [...new Set([...ids, ...visibleIds])]);
  }

  function deleteSelectedImports() {
    if (!selectedImportIds.length) return;
    const selected = new Set(selectedImportIds);
    const nextImported = imported.filter((question) => !selected.has(question.id));
    const nextAttempts = attempts.filter((attempt) => !selected.has(attempt.questionId));
    setImported(nextImported);
    setAttempts(nextAttempts);
    setSelectedImportIds([]);
    localStorage.setItem("pnle-imported-questions", JSON.stringify(nextImported));
    localStorage.setItem("pnle-attempts", JSON.stringify(nextAttempts));
  }

  function resetProgress() {
    setAttempts([]);
    localStorage.setItem("pnle-attempts", "[]");
    setSelected(null);
    setRevealed(false);
  }

  function downloadTemplate() {
    const template = [
      "np,subject,topic,situation,question,option_a,option_b,option_c,option_d,answer,rationale_a,rationale_b,rationale_c,rationale_d",
      'NP3,Medical-Surgical Nursing,Cardiovascular Disorders,"A client reports crushing chest pain.",Which action is the priority?,Obtain a diet history,Assess airway and oxygenation,Schedule discharge teaching,Encourage ambulation,B,"History can wait.","ABCs guide the immediate assessment.","Teaching is not the priority.","Ambulation may increase oxygen demand."',
    ].join("\n");
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pnle-question-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!hydrated) return <main className="loading-screen">Preparing your review space…</main>;

  const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "practice", label: "Practice", icon: ClipboardCheck },
    { id: "vault", label: "The Vault", icon: BookOpen },
    { id: "import", label: "Import questions", icon: FileUp },
  ];

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="brand-row">
          <button className="brand" onClick={() => navigate("dashboard")} aria-label="Go to overview">
            <span className="brand-mark"><Zap size={18} strokeWidth={2.5} /></span>
            <span><strong>Pulse</strong><small>PNLE PRACTICE</small></span>
          </button>
          <button className="icon-button mobile-only" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={20} /></button>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}>
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === "bank" && <small>{questions.length}</small>}
                {item.id === "vault" && vaultQuestions.length > 0 && <small>{vaultQuestions.length}</small>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-section">
          <p>Quick practice</p>
          {PRACTICES.map((np, index) => (
            <button key={np} className="np-shortcut" onClick={() => startPractice(np)}>
              <span className={`np-dot np-${index + 1}`}>{index + 1}</span>
              <span>{np}</span>
              <small>{questions.filter((question) => question.np === np).length}</small>
            </button>
          ))}
        </div>

        <button className={`sidebar-bank-link ${view === "bank" ? "active" : ""}`} onClick={() => navigate("bank")}>
          <BookOpen size={18} /><span>Question bank</span><small>{questions.length}</small>
        </button>

        <div className="sidebar-footer">
          <div className="mini-progress">
            <div className="mini-progress-head"><span>This week</span><strong>{attempts.length} answered</strong></div>
            <div className="progress-track"><span style={{ width: `${Math.min(100, attempts.length * 10)}%` }} /></div>
          </div>
          <p>Stored privately on this device</p>
        </div>
      </aside>

      {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div>
            <span className="eyebrow">BOARD REVIEW WORKSPACE</span>
            <h1>{view === "dashboard" ? "Your PNLE review space" : view === "practice" ? "Practice session" : view === "bank" ? "Question bank" : view === "vault" ? "The Vault" : "Import questions"}</h1>
          </div>
          <div className="topbar-actions">
            <div className="streak-pill"><Flame size={17} /><span>{attempts.length ? "Keep going" : "Start your streak"}</span></div>
            <button className="avatar" aria-label="Profile">N</button>
          </div>
        </header>

        {view === "dashboard" && (
          <div className="page-content dashboard-page">
            {!hasPerformance && (
              <div className="preview-notice">
                <Sparkles size={17} />
                <span><strong>Your dashboard starts fresh.</strong> Answer your first question to build your personal progress data.</span>
                <button onClick={() => startPractice()}>Answer one <ArrowRight size={15} /></button>
              </div>
            )}

            <section className="hero-panel">
              <div className="hero-copy">
                <span className="hero-kicker"><Target size={16} /> TODAY'S REVIEW</span>
                <h2>Build recall.<br />Spot the pattern.</h2>
                <p>A focused mixed set from NP1–NP5, followed by option-by-option rationales.</p>
                <button className="primary-button" onClick={() => startPractice()}>
                  Start mixed practice <ArrowRight size={17} />
                </button>
              </div>
              <div className="hero-visual" aria-label="Question bank overview">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="hero-score">
                  <strong>{questions.length}</strong>
                  <span>questions ready</span>
                </div>
                <div className="floating-chip chip-one"><CheckCircle2 size={16} /> Rationales</div>
                <div className="floating-chip chip-two"><BarChart3 size={16} /> Topic trends</div>
              </div>
            </section>

            <section className="metrics-strip" aria-label="Study metrics">
              <div><span>Questions answered</span><strong>{attempts.length}</strong><small>{imported.length} imported</small></div>
              <div><span>Current accuracy</span><strong>{attempts.length ? `${accuracy}%` : "—"}</strong><small>{attempts.length ? `${attempts.filter((a) => a.correct).length} correct` : "Starts after question 1"}</small></div>
              <div><span>Question bank</span><strong>{questions.length}</strong><small>Across NP1–NP5</small></div>
              <div><span>Topics practiced</span><strong>{topicStats.length}</strong><small>of {new Set(questions.map((q) => q.topic)).size} available</small></div>
            </section>

            <div className="dashboard-grid">
              <section className="panel mastery-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">MASTERY MAP</span><h3>Strength by Nursing Practice</h3></div>
                  <span className="subtle-label">{hasPerformance ? "Your results" : "No practice yet"}</span>
                </div>
                <div className="mastery-list">
                  {PRACTICES.map((np, index) => {
                    const score = displayedScores[np];
                    return (
                      <button key={np} className="mastery-row" onClick={() => startPractice(np)}>
                        <span className={`mastery-number np-${index + 1}`}>{index + 1}</span>
                        <span className="mastery-meta"><strong>{np}</strong><small>{questions.filter((q) => q.np === np).length} questions</small></span>
                        <span className="mastery-bar"><i style={{ width: `${score}%` }} /></span>
                        <strong className={`score ${scoreTone(score)}`}>{score}%</strong>
                        <ArrowRight size={16} />
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="panel attention-panel">
                <div className="panel-heading">
                  <div><span className="section-kicker">FOCUS NEXT</span><h3>Needs attention</h3></div>
                  <Target size={20} />
                </div>
                <div className="attention-list">
                  {attentionTopics.length ? attentionTopics.map((item, index) => (
                    <button key={`${item.topic}-${index}`} onClick={() => startPractice(item.np as Practice)}>
                      <span className="attention-rank">0{index + 1}</span>
                      <span><strong>{item.topic}</strong><small>{item.np} · {item.attempts} attempts</small></span>
                      <span className={`attention-score ${scoreTone(item.score)}`}>{item.score}%</span>
                    </button>
                  )) : <div className="attention-empty">Answer questions to identify the topics that need your attention.</div>}
                </div>
                <button className="text-button" onClick={() => startPractice(attentionTopics[0]?.np as Practice)}> {attentionTopics.length ? "Practice weakest area" : "Start practicing"} <ArrowRight size={15} /></button>
              </section>
            </div>

            <section className="weekly-panel panel">
              <div className="panel-heading"><div><span className="section-kicker">THIS WEEK</span><h3>Your study snapshot</h3></div><span className="subtle-label">Last 7 days</span></div>
              <div className="weekly-stats"><div><strong>{attempts.length}</strong><span>questions answered</span></div><div><strong>{attempts.length ? `${accuracy}%` : "—"}</strong><span>average score</span></div><button onClick={() => navigate("vault")}><strong>{vaultQuestions.length}</strong><span>in The Vault</span></button></div>
              <div className="weekly-focus"><div><span className="focus-dot strong" /><p><small>Strongest area</small><strong>{strongestTopic?.topic || "Build your first strength"}</strong></p></div><div><span className="focus-dot focus" /><p><small>Focus area</small><strong>{focusTopic?.topic || "Answer a few questions to spot it"}</strong></p></div></div>
            </section>

            <section className="bottom-cta">
              <div><span className="cta-icon"><Upload size={20} /></span><div><strong>Bring your own review sets</strong><p>Import CSV, TSV, or JSON questions and label every item by NP, subject, and topic.</p></div></div>
              <button className="secondary-button" onClick={() => navigate("import")}><Plus size={17} /> Add questions</button>
            </section>

            <section className="dashboard-bank panel">
              <div className="panel-heading"><div><span className="section-kicker">QUESTION BANK</span><h3>Keep your material organized</h3></div><button className="text-button" onClick={() => navigate("bank")}>Open question bank <ArrowRight size={15} /></button></div>
              <div className="dashboard-bank-list">{questions.slice(0, 4).map((question) => <button key={question.id} onClick={() => startPractice(question.np)}><span>{question.np}</span><p>{question.stem}</p><small>{question.subject}</small></button>)}</div>
            </section>
          </div>
        )}

        {view === "practice" && (
            <div className={`page-content practice-page exam-mode-page ${scratchOpen ? "scratch-open" : ""}`}>
            <div className="practice-toolbar">
              <div className="segmented" role="group" aria-label="Nursing Practice filter">
                <button className={practiceNp === "All" ? "active" : ""} onClick={() => changePracticeFilter("All")}>Mixed</button>
                {PRACTICES.map((np) => <button key={np} className={practiceNp === np ? "active" : ""} onClick={() => changePracticeFilter(np)}>{np}</button>)}
              </div>
              <label className="select-wrap">
                <span className="sr-only">Filter by subject</span>
                <select value={practiceSubject} onChange={(event) => { setPracticeSubject(event.target.value); setQuestionIndex(0); setSelected(null); setRevealed(false); }}>
                  <option>All subjects</option>
                  {subjects.map((subject) => <option key={subject}>{subject}</option>)}
                </select>
                <ChevronDown size={16} />
              </label>
            </div>

            {currentQuestion ? (
              <section className="exam-paper">
                <div className="exam-progress-head">
                  <span>Question {(questionIndex % filteredPractice.length) + 1} of {filteredPractice.length}</span>
                  <span>{flagged.length} flagged</span>
                </div>
                <div className="exam-progress"><span style={{ width: `${(((questionIndex % filteredPractice.length) + 1) / filteredPractice.length) * 100}%` }} /></div>

                <div className="exam-tools" role="toolbar" aria-label="Exam annotation tools">
                  <div className="tool-cluster">
                    <button className={examTool === "highlight" ? "active" : ""} onClick={() => setExamTool(examTool === "highlight" ? null : "highlight")} aria-pressed={examTool === "highlight"}><Highlighter size={16} /> Highlighter</button>
                    {examTool === "highlight" && <div className="color-picker" aria-label="Highlighter color">{(Object.keys(ANNOTATION_COLORS) as AnnotationColor[]).map((color) => <button key={color} className={`color-dot ${color} ${highlightColor === color ? "selected" : ""}`} onClick={() => setHighlightColor(color)} aria-label={`${ANNOTATION_COLORS[color].label} highlighter`} />)}</div>}
                  </div>
                  <div className="tool-cluster">
                    <button className={examTool === "pen" ? "active" : ""} onClick={() => setExamTool(examTool === "pen" ? null : "pen")} aria-pressed={examTool === "pen"}><PenTool size={16} /> Pen {examTool === "pen" ? "on" : ""}</button>
                    {examTool === "pen" && <><div className="pen-style-picker" aria-label="Pen tools">
                      <button className={penMode === "underline" ? "active" : ""} onClick={() => setPenMode("underline")} aria-label="Underline"><Underline size={15} /></button>
                      <button className={penMode === "circle" ? "active" : ""} onClick={() => setPenMode("circle")} aria-label="Encircle"><Circle size={15} /></button>
                      <button className={penMode === "box" ? "active" : ""} onClick={() => setPenMode("box")} aria-label="Draw box"><Square size={14} /></button>
                      <button className={penMode === "strike" ? "active" : ""} onClick={() => setPenMode("strike")} aria-label="Strikethrough"><Strikethrough size={15} /></button>
                      <button className={penMode === "scribble" ? "active" : ""} onClick={() => setPenMode("scribble")} aria-label="Scribble"><Spline size={15} /></button>
                      <button className={penMode === "erase" ? "active danger" : ""} onClick={() => setPenMode("erase")} aria-label="Erase pen marks"><Eraser size={15} /></button>
                    </div><div className="color-picker" aria-label="Pen color">{(Object.keys(ANNOTATION_COLORS) as AnnotationColor[]).map((color) => <button key={color} className={`color-dot ${color} ${penColor === color ? "selected" : ""}`} onClick={() => setPenColor(color)} aria-label={`${ANNOTATION_COLORS[color].label} pen`} />)}</div></>}
                  </div>
                  <button className={scratchOpen ? "active" : ""} onClick={() => setScratchOpen((open) => !open)}><NotebookPen size={16} /> Scratch pad</button>
                  <button onClick={() => setXSide(xSide === "right" ? "left" : "right")}><ArrowLeftRight size={16} /> X on {xSide}</button>
                  <button className="clear-marks" onClick={clearMarks} disabled={!currentMarkings.length && !currentTextPenMarks.length && !Object.keys(currentHighlights).length} title="Clear pen and highlighter marks"><Eraser size={16} /><span>Clear marks</span></button>
                </div>

                <button className={`flag-button ${flagged.includes(currentQuestion.id) ? "flagged" : ""}`} onClick={toggleFlag}>
                  <Flag size={15} fill={flagged.includes(currentQuestion.id) ? "currentColor" : "none"} />
                  {flagged.includes(currentQuestion.id) ? "Flagged for review" : "Flag for review"}
                </button>

                <div className={`exam-annotatable ${examTool ? `tool-${examTool}` : ""}`}>
                  {currentQuestion.situation && (
                    <section className="exam-situation-box">
                      <div className="exam-classification"><span>Situation</span><i>·</i><span>{currentQuestion.np}</span><small>{currentQuestion.topic}</small></div>
                      <p>{renderHighlightText(currentQuestion.situation, "situation")}</p>
                    </section>
                  )}
                  <div className="exam-question-box">
                    <div className="exam-classification"><span>{currentQuestion.np}</span><i>·</i><span>{currentQuestion.topic}</span><small>{currentQuestion.source === "sample" ? "SAMPLE BANK" : "IMPORTED"}</small></div>
                    <h2>{renderHighlightText(currentQuestion.stem, "question")}</h2>
                  </div>

                  <div className={`exam-choice-list x-${xSide}`} role="radiogroup" aria-label="Answer choices">
                    {LETTERS.map((letter) => {
                      const isSelected = selected === letter;
                      const isEliminated = currentEliminated.includes(letter);
                      const isCorrect = revealed && letter === currentQuestion.correct;
                      const isWrong = revealed && isSelected && letter !== currentQuestion.correct;
                      const choiceButton = (
                        <button
                          className={`exam-choice ${isSelected ? "selected" : ""} ${isEliminated ? "eliminated" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                          onPointerDownCapture={() => !revealed && !isEliminated && setSelected(letter)}
                          onClick={() => !revealed && !isEliminated && setSelected(letter)}
                          role="radio"
                          aria-checked={isSelected}
                          aria-label={`${letter}. ${currentQuestion.choices[letter]}${isEliminated ? ", eliminated" : ""}`}
                          disabled={revealed}
                        >
                          <span className="exam-choice-letter">{letter}.</span>
                          <span>{renderHighlightText(currentQuestion.choices[letter], `choice-${letter}`)}</span>
                        </button>
                      );
                      const xButton = (
                        <button className={`eliminate-button ${isEliminated ? "active" : ""}`} onClick={() => toggleEliminated(letter)} disabled={revealed} aria-label={`${isEliminated ? "Restore" : "Eliminate"} option ${letter}`} title={`${isEliminated ? "Restore" : "Eliminate"} option ${letter}`}><X size={18} /></button>
                      );
                      return <div className="exam-choice-row" key={letter}>{xSide === "left" && xButton}{choiceButton}{xSide === "right" && xButton}</div>;
                    })}
                  </div>

                  <svg
                    ref={markingLayerRef}
                    className="marking-layer"
                    aria-hidden="true"
                  >
                    {currentMarkings.map((mark) => <path key={mark.id} d={mark.d} className={`mark-path ${mark.kind} ${mark.tool}`} style={{ stroke: ANNOTATION_COLORS[mark.color].ink }} />)}
                  </svg>
                </div>

                <div className="exam-keyboard-tip">Tip: press <kbd>1</kbd>–<kbd>4</kbd> to pick an answer, then <kbd>Space</kbd> to submit.</div>
                <div className="confidence-row">
                  <span>How sure are you?</span>
                  <div role="group" aria-label="Answer confidence">
                    {([['sure', "I'm sure"], ['unsure', 'Not sure'], ['guessing', 'Guessing']] as [Exclude<Confidence, null>, string][]).map(([value, label]) => (
                      <button key={value} className={confidence[currentQuestion.id] === value ? "active" : ""} onClick={() => setConfidence((previous) => ({ ...previous, [currentQuestion.id]: value }))}>{label}</button>
                    ))}
                  </div>
                </div>

                <div className="exam-footer">
                  {currentQuestionPosition > 0 ? <button className="icon-text-button" onClick={previousQuestion}><ArrowLeft size={17} /> Previous</button> : <span />}
                  {!revealed ? <button className="primary-button" disabled={!selected} onClick={checkAnswer}>Submit answer <Check size={17} /></button> : <button className="primary-button" onClick={nextQuestion}>Next question <ArrowRight size={17} /></button>}
                </div>

                {revealed && (
                  <div className="exam-rationale">
                    <div className={`result-banner ${selected === currentQuestion.correct ? "correct" : "wrong"}`}>
                      {selected === currentQuestion.correct ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
                      <div><span>{selected === currentQuestion.correct ? "Correct" : "Not quite"}</span><strong>The answer is {currentQuestion.correct}.</strong></div>
                    </div>
                    <div className="exam-rationale-grid">
                      {LETTERS.map((letter) => <div className={`rationale-item ${letter === currentQuestion.correct ? "answer" : ""}`} key={letter}><span>{letter}</span><p>{currentQuestion.rationales[letter] || (letter === currentQuestion.correct ? "This is the best answer based on the priority and clinical cues in the question." : "This option does not best address the question's priority.")}</p></div>)}
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <div className="empty-state"><BookOpen size={28} /><h2>No questions match these filters</h2><p>Try another subject or import questions for this area.</p><button className="primary-button" onClick={() => { setPracticeNp("All"); setPracticeSubject("All subjects"); }}>Clear filters</button></div>
            )}

            {scratchOpen && currentQuestion && (
              <aside className="scratch-bottom-panel" aria-label="Scratch pad">
                <div className="scratch-head"><div><NotebookPen size={18} /><span><strong>Scratch pad</strong><small>Question {(questionIndex % filteredPractice.length) + 1} · stays until you clear it</small></span></div><button onClick={() => setScratchOpen(false)} aria-label="Collapse scratch pad"><X size={18} /></button></div>
                <div className="scratch-tool-row" role="toolbar" aria-label="Scratch pad tools">
                  <div className="scratch-tabs"><button className={scratchMode === "draw" ? "active" : ""} onClick={() => setScratchMode("draw")}>Draw</button><button className={scratchMode === "type" ? "active" : ""} onClick={() => setScratchMode("type")}>Type</button></div>
                  <div className="scratch-tool-picker">
                    <button className={scratchTool === "pen" ? "active" : ""} onClick={() => setScratchTool("pen")} aria-label="Scratch pen"><PenTool size={15} /></button>
                    <button className={scratchTool === "highlight" ? "active" : ""} onClick={() => setScratchTool("highlight")} aria-label="Scratch highlighter"><Highlighter size={15} /></button>
                    <button className={scratchTool === "erase" ? "active danger" : ""} onClick={() => setScratchTool("erase")} aria-label="Erase scratch marks"><Eraser size={15} /></button>
                    <div className="color-picker scratch-colors" aria-label="Scratch color">{(Object.keys(ANNOTATION_COLORS) as AnnotationColor[]).map((color) => <button key={color} className={`color-dot ${color} ${scratchColor === color ? "selected" : ""}`} onClick={() => setScratchColor(color)} aria-label={`${ANNOTATION_COLORS[color].label} scratch color`} />)}</div>
                  </div>
                </div>
                <div className={`scratch-surface ${scratchMode === "draw" ? "draw-mode" : "type-mode"}`}>
                  {scratchMode === "type" && <textarea value={scratchNotes[currentQuestion.id] || ""} onChange={(event) => updateScratch(event.target.value)} placeholder={'Notes…\n\nFormula:\nWorkings:\nFinal answer:'} />}
                  <svg ref={scratchLayerRef} className="scratch-marking-layer" onPointerDown={startScratchMark} onPointerMove={continueScratchMark} onPointerUp={stopScratchMark} onPointerCancel={stopScratchMark} aria-label="Scratch drawing surface">
                    {currentScratchMarks.map((mark) => <path key={mark.id} d={mark.d} className={`scratch-mark ${mark.tool}`} style={{ stroke: mark.tool === "highlight" ? ANNOTATION_COLORS[mark.color].highlight : ANNOTATION_COLORS[mark.color].ink }} />)}
                  </svg>
                  {scratchMode === "draw" && <p className="scratch-draw-hint">Draw with your mouse or finger. Choose the pen, highlighter, or eraser above.</p>}
                </div>
                <div className="scratch-actions"><button onClick={clearScratchPad}><Eraser size={15} /> Clear pad</button><span>{(scratchNotes[currentQuestion.id] || "").length} typed · {currentScratchMarks.length} marks</span></div>
              </aside>
            )}
          </div>
        )}

        {view === "bank" && (
          <div className="page-content bank-page">
            <div className="page-intro">
              <div><span className="section-kicker">ORGANIZED REVIEW LIBRARY</span><h2>{questions.length} questions across NP1–NP5</h2><p>Find an item by keyword, subject, or topic. Imported questions stay on this device.</p></div>
              <button className="primary-button" onClick={() => navigate("import")}><Plus size={17} /> Import questions</button>
            </div>
            <div className="bank-controls">
              <label className="search-box"><Search size={18} /><input value={bankQuery} onChange={(event) => setBankQuery(event.target.value)} placeholder="Search questions, subjects, or topics" /></label>
              <div className="segmented compact" role="group" aria-label="Filter question bank">
                <button className={bankNp === "All" ? "active" : ""} onClick={() => setBankNp("All")}>All</button>
                {PRACTICES.map((np) => <button key={np} className={bankNp === np ? "active" : ""} onClick={() => setBankNp(np)}>{np}</button>)}
              </div>
            </div>
            <div className="batch-import-actions">
              <label><input type="checkbox" checked={bankQuestions.filter((question) => question.source === "imported").length > 0 && bankQuestions.filter((question) => question.source === "imported").every((question) => selectedImportIds.includes(question.id))} onChange={toggleVisibleImported} /> Select imported questions shown</label>
              <div>{selectedImportIds.length > 0 && <><span>{selectedImportIds.length} selected</span><button className="batch-delete-button" onClick={deleteSelectedImports}><Trash2 size={15} /> Delete selected</button></>}</div>
            </div>
            <div className="bank-list">
              <div className="bank-list-head"><span>Question</span><span>Classification</span><span>Source</span><span>Actions</span></div>
              {bankQuestions.map((question, index) => (
                <article key={question.id} className="bank-row">
                  <div className="bank-question">{question.source === "imported" ? <input className="import-select" type="checkbox" checked={selectedImportIds.includes(question.id)} onChange={() => toggleImportedSelection(question.id)} aria-label={`Select question ${index + 1}`} /> : <span className="bank-number">{String(index + 1).padStart(2, "0")}</span>}<p>{question.stem}</p></div>
                  <div className="bank-class"><strong>{question.np} · {question.subject}</strong><small>{question.topic}</small></div>
                  <span className={`source-label ${question.source}`}>{question.source}</span>
                  <div className="bank-actions">
                    <button onClick={() => { setPracticeNp(question.np); setPracticeSubject(question.subject); setQuestionIndex(Math.max(0, questions.filter((q) => q.np === question.np && q.subject === question.subject).findIndex((q) => q.id === question.id))); setSelected(null); setRevealed(false); navigate("practice"); }} aria-label="Practice this question"><ArrowRight size={17} /></button>
                    {question.source === "imported" && <button className="danger" onClick={() => deleteImported(question.id)} aria-label="Delete imported question"><Trash2 size={16} /></button>}
                  </div>
                </article>
              ))}
              {!bankQuestions.length && <div className="list-empty">No questions match your search.</div>}
            </div>
            {attempts.length > 0 && <button className="reset-link" onClick={resetProgress}><RotateCcw size={15} /> Reset all practice progress</button>}
          </div>
        )}

        {view === "vault" && (
          <div className="page-content bank-page vault-page">
            <div className="page-intro"><div><span className="section-kicker">REVIEW WHAT YOU MISSED</span><h2>The Vault</h2><p>Questions go here when your first answer is incorrect. Keep them for review, or remove them when you feel ready.</p></div><button className="primary-button" onClick={() => startPractice()}><ClipboardCheck size={17} /> Practice mixed set</button></div>
            {vaultQuestions.length ? <div className="bank-list vault-list"><div className="bank-list-head"><span>Question</span><span>Classification</span><span>Source</span><span /></div>{vaultQuestions.map((question, index) => <article key={question.id} className="bank-row"><div className="bank-question"><span>{String(index + 1).padStart(2, "0")}</span><p>{question.stem}</p></div><div className="bank-class"><strong>{question.np} · {question.subject}</strong><small>{question.topic}</small></div><span className="source-label imported">Vault</span><div className="bank-actions"><button onClick={() => { setPracticeNp(question.np); setPracticeSubject(question.subject); setQuestionIndex(0); setSelected(null); setRevealed(false); navigate("practice"); }} aria-label="Practice this question"><ArrowRight size={17} /></button><button className="danger" onClick={() => removeFromVault(question.id)} aria-label="Remove from The Vault"><Trash2 size={16} /></button></div></article>)}</div> : <div className="empty-state"><BookOpen size={28} /><h2>Your Vault is clear</h2><p>Missed questions will be saved here automatically so you can revisit them later.</p><button className="primary-button" onClick={() => startPractice()}>Practice now</button></div>}
          </div>
        )}

        {view === "import" && (
          <div className="page-content import-page">
            <div className="page-intro">
              <div><span className="section-kicker">BUILD YOUR REVIEW BANK</span><h2>Import questions in one batch</h2><p>Upload CSV, TSV, JSON, or a text-based PDF. PDFs are extracted into a review step before import.</p></div>
              <button className="secondary-button" onClick={downloadTemplate}><Download size={17} /> Download CSV template</button>
            </div>
            <div className={`import-grid ${importGuideOpen ? "guide-open" : "guide-collapsed"}`}>
              <section className="panel import-card">
                <div className="dropzone" onClick={() => fileRef.current?.click()}>
                  <input ref={fileRef} type="file" accept=".csv,.tsv,.json,.txt,.pdf,application/pdf" onChange={handleFile} />
                  <span className="upload-icon"><FileUp size={24} /></span>
                  <h3>Choose a question file</h3>
                  <p>CSV, TSV, JSON, plain text, or PDF · processed on your device</p>
                  <button className="secondary-button" type="button">Browse files</button>
                </div>
                <div className="or-divider"><span>or paste the contents</span></div>
                <label className="paste-field">
                  <span>Question data</span>
                  <textarea value={importText} onChange={(event) => { setImportText(event.target.value); setImportMessage(null); }} placeholder={'np,subject,topic,question,option_a,option_b,option_c,option_d,answer\nNP1,Community Health Nursing,Epidemiology,Which measure counts new cases?,Prevalence,Incidence,Mortality ratio,Attack risk,B'} />
                </label>
                {importMessage && <div className={`import-message ${importMessage.type}`}>{importMessage.type === "success" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}<span>{importMessage.text}</span></div>}
                <button className="primary-button import-button" disabled={!importText.trim()} onClick={importQuestions}><Upload size={17} /> Validate and import</button>
                {pdfCandidates.length > 0 && (
                  <section className="pdf-review" aria-label="PDF import review">
                    <div className="pdf-review-head"><div><span className="section-kicker">PDF REVIEW</span><h3>{pdfFileName}</h3><p>{pdfCandidates.length} extracted questions. The proposed category is editable before import.</p></div><span className="pdf-count">{pdfCandidates.length} items</span></div>
                    <div className="batch-fields">
                      <label><span>Nursing Practice</span><select value={batchNp} onChange={(event) => setBatchNp(event.target.value as Practice)}>{PRACTICES.map((np) => <option key={np}>{np}</option>)}</select></label>
                      <label><span>Subject</span><input value={batchSubject} onChange={(event) => setBatchSubject(event.target.value)} list="pdf-subjects" /></label>
                      <label><span>Topic</span><input value={batchTopic} onChange={(event) => setBatchTopic(event.target.value)} /></label>
                      <datalist id="pdf-subjects">{subjects.map((subject) => <option key={subject} value={subject} />)}</datalist>
                    </div>
                    <div className="pdf-suggestions"><Sparkles size={16} /><span>Suggested from the PDF’s wording: <strong>{batchNp} · {batchSubject}</strong>. You can change this for the entire batch.</span></div>
                    {pdfIssues.length > 0 && <div className="pdf-issue-jump"><XCircle size={17} /><div><strong>{pdfIssues.length} item{pdfIssues.length === 1 ? " needs" : "s need"} review</strong><span>Fix the highlighted questions before importing.</span></div><nav>{pdfIssues.map(({ index }) => <a key={index} href={`#pdf-candidate-${index + 1}`}>Q{index + 1}</a>)}</nav></div>}
                    <div className="pdf-candidate-list">
                      {pdfCandidates.map((candidate, index) => { const issue = pdfCandidateIssue(candidate); return <article id={`pdf-candidate-${index + 1}`} className={`pdf-candidate ${issue ? "needs-review" : ""}`} key={candidate.id}><div><div className="pdf-candidate-title"><strong>Q{index + 1}</strong>{issue && <span>Needs review</span>}<button type="button" onClick={() => fillAllPdfRationales(index)}><Sparkles size={13} /> Fill all rationales</button></div><label className="pdf-edit-field"><span>Situation</span><textarea value={candidate.situation || ""} onChange={(event) => updatePdfCandidate(index, "situation", event.target.value)} placeholder="No shared situation detected" /></label><label className="pdf-edit-field"><span>Question</span><textarea value={candidate.stem} onChange={(event) => updatePdfCandidate(index, "stem", event.target.value)} /></label><div className="pdf-choice-editor">{LETTERS.map((letter) => <div className="pdf-choice-rationale" key={letter}><label className="pdf-edit-field"><span>Choice {letter}</span><textarea value={candidate.choices[letter]} onChange={(event) => updatePdfCandidate(index, letter, event.target.value)} /></label><label className="pdf-edit-field"><span>Extracted rationale</span><textarea value={candidate.rationales[letter] || ""} onChange={(event) => updatePdfRationale(index, letter, event.target.value)} placeholder="No rationale extracted" /></label><div className="rationale-actions"><button type="button" className="fill-rationale-button" onClick={() => fillPdfRationale(index, letter)}><Sparkles size={12} /> Fill template</button><button type="button" className="generate-rationale-button" disabled={aiGenerating === `${index}-${letter}`} onClick={() => generatePdfRationale(index, letter)}><Sparkles size={12} /> {aiGenerating === `${index}-${letter}` ? "Generating…" : "Generate with AI"}</button></div></div>)}</div><small>{issue || `${candidate.situation ? "Shared situation preserved" : "Stand-alone question"} · ${candidate.answerDetected ? "Answer detected" : "Confirm answer"}`}</small></div><label><span>Answer</span><select value={candidate.correct} onChange={(event) => setPdfCandidates((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, correct: event.target.value as Letter } : item))}>{LETTERS.map((letter) => <option key={letter}>{letter}</option>)}</select></label></article>; })}
                    </div>
                    <button className="primary-button import-button" disabled={pdfIssues.length > 0} onClick={importPdfBatch}><Upload size={17} /> {pdfIssues.length ? "Fix flagged questions to import" : "Add reviewed PDF batch"}</button>
                  </section>
                )}
              </section>

              <aside className={`import-guide ${importGuideOpen ? "open" : "collapsed"}`}>
                <button className="import-guide-toggle" onClick={() => setImportGuideOpen((open) => !open)} aria-expanded={importGuideOpen}><span>Format guide</span><ChevronDown size={17} /></button>
                {importGuideOpen && <div className="import-guide-content"><span className="section-kicker">FORMAT GUIDE</span>
                <h3>Required columns</h3>
                <div className="field-list">
                  {["PDF batch — choose NP + subject after extraction", "CSV: np — NP1, NP2, NP3, NP4, or NP5", "subject and topic", "question", "option_a, option_b, option_c, option_d", "answer — A, B, C, or D"].map((field) => <div key={field}><Check size={15} /><span>{field}</span></div>)}
                </div>
                <h3>Optional, but useful</h3>
                <div className="field-list optional">
                  {["situation", "rationale_a through rationale_d", "rationale — for the correct answer"].map((field) => <div key={field}><Plus size={15} /><span>{field}</span></div>)}
                </div>
                <div className="guide-tip"><Sparkles size={18} /><p><strong>Best review experience</strong><br />Include a rationale for every choice so you learn why distractors are wrong—not only which letter is correct.</p></div>
                <div className="bank-summary"><span>Current bank</span><strong>{questions.length}</strong><small>{imported.length} imported</small></div>
                </div>}
              </aside>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
