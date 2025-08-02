import { readFileSync, writeFileSync } from 'fs';

const INPUT_FILE_PATH = 'types/database.types.ts';
const OUTPUT_FILE_PATH = 'types/index.ts';
const IMPORT_PATH = './database.types';

function singularize(name: string): string {
  const exceptions = ['status', 'events_attendance'];
  if (exceptions.includes(name)) {
    return name;
  }

  if (name.endsWith('ies')) {
    return name.slice(0, -3) + 'y';
  }

  if (name.endsWith('s')) {
    return name.slice(0, -1);
  }

  return name;
}

function snakeToPascal(snake: string): string {
  return snake
    .split('_')
    .map((word) => {
      const singularWord = singularize(word);
      return singularWord.charAt(0).toUpperCase() + singularWord.slice(1);
    })
    .join('');
}

function generateTypes(): void {
  let content: string;

  try {
    content = readFileSync(INPUT_FILE_PATH, 'utf-8');
  } catch {
    console.error(`❌ Error: Input file not found at '${INPUT_FILE_PATH}'`);
    console.error('Please make sure the INPUT_FILE_PATH variable is set correctly.');
    return;
  }

  const tablesBlockMatch = content.match(/Tables:\s*{\s*([\s\S]*?)\s*}\s*Views:/);

  if (!tablesBlockMatch) {
    console.error(`❌ Error: Could not find the 'Tables' definition block in the input file.`);
    console.error('Please ensure the file is a valid Supabase types file that includes a Views block.');
    return;
  }

  const tablesBlock = tablesBlockMatch[1];
  const tableNames = [...tablesBlock.matchAll(/^\s*(\w+):\s*{\s*Row:/gm)].map((match) => match[1]);

  if (tableNames.length === 0) {
    console.warn('⚠️ Warning: No tables found in the input file.');
    return;
  }

  const outputLines = [
    `import type { Database } from '${IMPORT_PATH}'\n`,
    '// Generic type helpers',
    'type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]',
    'type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]',
    'type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]\n',
    '// Tables',
  ];

  tableNames.sort().forEach((name) => {
    const pascal = snakeToPascal(name);

    outputLines.push(`export type ${pascal} = Tables<"${name}">`);
    outputLines.push(`export type ${pascal}Insert = TablesInsert<"${name}">`);
    outputLines.push(`export type ${pascal}Update = TablesUpdate<"${name}">\n`);
  });

  writeFileSync(OUTPUT_FILE_PATH, outputLines.join('\n'), 'utf-8');
  console.log(`✅ Successfully generated ${tableNames.length} table types in '${OUTPUT_FILE_PATH}'!`);
}

generateTypes();
