import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/config/prisma.js";

interface RawQuestion {
  question: string;
  option: { a: string; b: string; c: string; d: string; e?: string };
  section?: string;
  image?: string;
  answer: string;
  solution?: string;
  examtype?: string;
  examyear?: string;
  questionNub?: number;
  hasPassage?: number | boolean;
  category?: string;
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function parseArgs() {
  const [, , fileArg, subjectArg] = process.argv;
  return {
    filePath: path.resolve(fileArg ?? "data/mathematics.json"),
    subject: (subjectArg ?? "mathematics").toLowerCase(),
  };
}

function validateRawQuestion(item: unknown, index: number): RawQuestion {
  if (!item || typeof item !== "object") {
    fail(`Question at index ${index} is not an object`);
  }

  const q = item as Partial<RawQuestion>;

  if (typeof q.question !== "string" || !q.question.trim()) {
    fail(`Question at index ${index} is missing "question"`);
  }

  if (!q.option || typeof q.option !== "object") {
    fail(`Question at index ${index} is missing "option"`);
  }

  for (const key of ["a", "b", "c", "d"] as const) {
    if (typeof q.option[key] !== "string") {
      fail(`Question at index ${index} is missing option "${key}"`);
    }
  }

  if (typeof q.answer !== "string" || !q.answer.trim()) {
    fail(`Question at index ${index} is missing "answer"`);
  }

  if (
    q.questionNub !== undefined &&
    q.questionNub !== null &&
    !Number.isInteger(q.questionNub)
  ) {
    fail(`Question at index ${index} has a non-integer "questionNub"`);
  }

  return q as RawQuestion;
}

function normalizeQuestion(text: string) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function yearNumberKey(
  examYear: string | null | undefined,
  questionNub: number | null | undefined,
) {
  if (examYear == null || examYear === "" || questionNub == null) return null;
  return `${String(examYear)}|${questionNub}`;
}

function toRecord(q: RawQuestion, subject: string) {
  return {
    // The database primary key (`id`) is intentionally omitted so Postgres
    // generates the UUID. The source `id` is not used at all, and `mockId` is
    // left empty (NULL) for imported questions.
    subject,
    topic: q.category ?? null,
    question: q.question,
    answer: q.answer,
    section: q.section ?? "",
    questionNub: typeof q.questionNub === "number" ? q.questionNub : null,
    hasPassage: Boolean(q.hasPassage),
    category: q.category ?? null,
    options: q.option,
    solution: q.solution || null,
    image: q.image || null,
    examType: q.examtype || null,
    examYear: q.examyear != null ? String(q.examyear) : null,
  };
}

async function main() {
  const { filePath, subject } = parseArgs();

  if (!fs.existsSync(filePath)) {
    fail(`File not found: ${filePath}`);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    fail(`Expected ${filePath} to contain a JSON array`);
  }
  if (raw.length === 0) {
    fail(`No records found in ${filePath}`);
  }

  const records = raw.map((item, index) => {
    const validated = validateRawQuestion(item, index);
    return toRecord(validated, subject);
  });

  // Deduplicate on subject + exam year + question number. The source `id` and
  // `mockId` are deliberately ignored so re-imports never create duplicates.
  const existing = await prisma.question.findMany({
    where: { subject },
    select: { examYear: true, questionNub: true, question: true },
  });

  const existingKeys = new Set<string>();
  const existingQuestions = new Set<string>();
  for (const row of existing) {
    const key = yearNumberKey(row.examYear, row.questionNub);
    if (key) existingKeys.add(key);
    existingQuestions.add(normalizeQuestion(row.question));
  }

  const seenKeys = new Set<string>();
  const seenQuestions = new Set<string>();
  const toInsert: ReturnType<typeof toRecord>[] = [];
  let skipped = 0;

  for (const record of records) {
    const key = yearNumberKey(record.examYear, record.questionNub);

    if (key) {
      if (existingKeys.has(key) || seenKeys.has(key)) {
        skipped++;
        continue;
      }
      seenKeys.add(key);
      toInsert.push(record);
      continue;
    }

    // Without both a year and a question number we cannot apply the year +
    // number rule, so fall back to exact question text to stay duplicate-free.
    const text = normalizeQuestion(record.question);
    if (existingQuestions.has(text) || seenQuestions.has(text)) {
      skipped++;
      continue;
    }
    seenQuestions.add(text);
    toInsert.push(record);
  }

  console.log(
    `🌱 Importing ${records.length} "${subject}" questions from ${filePath}...`,
  );
  console.log(
    `⏭️  Skipped ${skipped} already present (subject + exam year + question number).`,
  );

  if (toInsert.length > 0) {
    const inserted = await prisma.question.createMany({
      data: toInsert,
      skipDuplicates: true,
    });
    console.log(`✅ Inserted ${inserted.count} new rows.`);
  } else {
    console.log("✅ Inserted 0 new rows.");
  }

  const subjectRows = await prisma.question.findMany({
    where: { subject },
    select: { examYear: true, questionNub: true, question: true },
  });
  const subjectKeys = new Set<string>();
  const subjectQuestions = new Set<string>();
  for (const row of subjectRows) {
    const key = yearNumberKey(row.examYear, row.questionNub);
    if (key) subjectKeys.add(key);
    subjectQuestions.add(normalizeQuestion(row.question));
  }

  let verified = 0;
  for (const record of records) {
    const key = yearNumberKey(record.examYear, record.questionNub);
    if (key ? subjectKeys.has(key) : subjectQuestions.has(normalizeQuestion(record.question))) {
      verified++;
    }
  }

  if (verified !== records.length) {
    fail(
      `Count validation failed: expected ${records.length} "${subject}" questions in the database, found ${verified}`,
    );
  }

  console.log(
    `✅ Validated ${verified}/${records.length} "${subject}" questions present (subject total: ${subjectRows.length}).`,
  );
}

main()
  .catch((error) => {
    console.error("❌ Import failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
