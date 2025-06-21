#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущий каталог в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к файлу с планом разработки
const README_PATH = path.join(__dirname, '../docs/IoTMonSys-developing_plan.md');

// Регулярные выражения для разбора файла
const HEADER_REGEX = /^(#+)\s+(.*?)(?:\s+-\s*(\d+)%\s*(?:done)?!?)?$/i;
const TASK_REGEX = /^- \[(x| )\]/;

// Функция для чтения файла
function readFile() {
  try {
    return fs.readFileSync(README_PATH, 'utf-8');
  } catch (error) {
    console.error(`Ошибка при чтении файла: ${error.message}`);
    process.exit(1);
  }
}

// Функция для записи в файл
function writeFile(content) {
  try {
    fs.writeFileSync(README_PATH, content, 'utf-8');
    console.log('Файл успешно обновлен!');
  } catch (error) {
    console.error(`Ошибка при записи в файл: ${error.message}`);
    process.exit(1);
  }
}

// Функция для генерации оглавления
function generateToc(lines) {
  const toc = ['## Содержание\n'];
  let inToc = false;

  for (const line of lines) {
    // Пропускаем существующее оглавление
    if (line.startsWith('## Содержание')) {
      inToc = true;
      continue;
    }
    if (inToc && line.trim() === '') {
      inToc = false;
      continue;
    }
    if (inToc) continue;

    const match = line.match(HEADER_REGEX);
    if (match) {
      const [_, hashes, title, percentage] = match;
      const indent = hashes.length > 1 ? '  '.repeat(hashes.length - 2) : '';
      const anchor = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      const progress = percentage ? ` (${percentage}%)` : '';
      toc.push(`${indent}- [${title}${progress}](#${anchor})`);
    }
  }

  return toc.join('\n') + '\n';
}

// Функция для обновления прогресса выполнения
function updateProgress(lines) {
  const result = [];
  let currentSection = null;

  for (const line of lines) {
    // Пропускаем существующее оглавление
    if (line.startsWith('## Содержание')) {
      result.push(line);
      continue;
    }

    // Проверяем, является ли строка заголовком раздела
    const headerMatch = line.match(HEADER_REGEX);
    if (headerMatch) {
      currentSection = {
        title: headerMatch[2],
        level: headerMatch[1].length,
        tasks: [],
        startIndex: result.length
      };
      result.push(line);
      continue;
    }

    // Если это задача в текущем разделе
    if (currentSection && TASK_REGEX.test(line)) {
      const isDone = line.includes('[x]');
      currentSection.tasks.push(isDone);
      result.push(line);
      continue;
    }

    // Если это конец раздела (пустая строка или следующий заголовок)
    if (currentSection && (line.trim() === '' || line.startsWith('#'))) {
      // Рассчитываем прогресс
      if (currentSection.tasks.length > 0) {
        const doneCount = currentSection.tasks.filter(Boolean).length;
        const progress = Math.round((doneCount / currentSection.tasks.length) * 100);

        // Обновляем заголовок с прогрессом
        const headerIndex = currentSection.startIndex;
        const headerLine = result[headerIndex];
        const newHeader = headerLine.replace(/\s*-\s*\d+%\s*(?:done)?!?\s*$/, '') + ` - ${progress}% done!`;
        result[headerIndex] = newHeader;
      }

      currentSection = null;
    }

    result.push(line);
  }

  return result;
}

// Основная функция
function main() {
  // Читаем файл
  const content = readFile();
  const lines = content.split('\n');

  // Генерируем новое оглавление
  const toc = generateToc(lines);

  // Обновляем прогресс выполнения
  const updatedLines = updateProgress(lines);

  // Заменяем старое оглавление на новое
  const contentWithoutToc = updatedLines.join('\n')
    .replace(/## Содержание[\s\S]*?(?=\n## )/g, '');

  const newContent = contentWithoutToc.replace(/^(# .+)/, `$1\n\n${toc}`);

  // Записываем обновленный файл
  writeFile(newContent);
}

// Запускаем скрипт
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}