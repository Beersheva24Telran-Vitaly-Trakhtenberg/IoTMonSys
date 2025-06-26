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

// Функция для сбора информации о прогрессе всех разделов
function collectSectionProgress(lines) {
  const sections = new Map();
  let currentSection = null;
  let currentPath = [];

  for (const line of lines) {
    // Проверяем, является ли строка заголовком раздела
    const headerMatch = line.match(HEADER_REGEX);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2];
      const percentage = headerMatch[3] ? parseInt(headerMatch[3], 10) : null;
      
      // Обновляем текущий путь в иерархии заголовков
      currentPath = currentPath.slice(0, level - 1);
      currentPath[level - 1] = title;
      
      const sectionPath = currentPath.slice(0, level).join('|');
      currentSection = {
        title,
        level,
        percentage,
        tasks: [],
        path: sectionPath
      };
      
      sections.set(sectionPath, currentSection);
      continue;
    }

    // Если это задача в текущем разделе
    if (currentSection && TASK_REGEX.test(line)) {
      const isDone = line.includes('[x]');
      currentSection.tasks.push(isDone);
    }
  }
  
  // Рассчитываем прогресс для каждого раздела
  for (const section of sections.values()) {
    if (section.tasks.length > 0 && section.percentage === null) {
      const doneCount = section.tasks.filter(Boolean).length;
      section.percentage = Math.round((doneCount / section.tasks.length) * 100);
    }
  }
  
  return sections;
}

// Функция для генерации оглавления
function generateToc(lines, sectionsProgress) {
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
      const [_, hashes, title] = match;
      const level = hashes.length;
      const indent = level > 1 ? '  '.repeat(level - 2) : '';
      
      // Создаем путь для поиска в карте разделов
      const currentPath = [];
      for (let i = 0; i < level; i++) {
        if (i === level - 1) {
          currentPath.push(title);
        } else {
          // Здесь должна быть логика для получения родительских заголовков
          // Упрощенно используем заполнитель
          currentPath.push('*');
        }
      }
      
      // Ищем раздел в карте по заголовку
      let sectionProgress = null;
      for (const [path, section] of sectionsProgress.entries()) {
        if (path.endsWith(title) && section.level === level) {
          sectionProgress = section.percentage;
          break;
        }
      }
      
      const anchor = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      const progress = sectionProgress !== null ? ` (${sectionProgress}%)` : '';
      
      // Выделяем пункты со 100% выполнения
      if (sectionProgress === 100) {
        toc.push(`${indent}- [**${title}${progress}**](#${anchor})`);
      } else {
        toc.push(`${indent}- [${title}${progress}](#${anchor})`);
      }
    }
  }

  return toc.join('\n') + '\n';
}

// Функция для обновления прогресса выполнения
function updateProgress(lines) {
  const result = [];
  let currentSections = []; // Стек для отслеживания вложенных разделов

  for (const line of lines) {
    // Проверяем, является ли строка заголовком раздела
    const headerMatch = line.match(HEADER_REGEX);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2];
      
      // Очищаем стек до текущего уровня
      currentSections = currentSections.filter(section => section.level < level);
      
      // Добавляем текущий раздел в стек
      currentSections.push({
        title,
        level,
        tasks: [],
        startIndex: result.length
      });
      
      result.push(line);
      continue;
    }

    // Если это задача в текущем разделе
    if (currentSections.length > 0 && TASK_REGEX.test(line)) {
      const isDone = line.includes('[x]');
      // Добавляем задачу ко всем открытым разделам
      for (const section of currentSections) {
        section.tasks.push(isDone);
      }
      result.push(line);
      continue;
    }

    // Если это конец раздела (пустая строка или следующий заголовок того же или более высокого уровня)
    if (currentSections.length > 0 && (line.trim() === '' || line.startsWith('#'))) {
      // Если это новый заголовок, проверяем его уровень
      let shouldPopSection = line.trim() === '';
      if (line.startsWith('#')) {
        const newHeaderMatch = line.match(HEADER_REGEX);
        if (newHeaderMatch) {
          const newLevel = newHeaderMatch[1].length;
          // Если новый заголовок того же или более высокого уровня, закрываем текущий раздел
          shouldPopSection = newLevel <= currentSections[currentSections.length - 1].level;
        }
      }
      
      if (shouldPopSection) {
        // Обрабатываем последний раздел в стеке
        const currentSection = currentSections.pop();
        
        // Рассчитываем прогресс
        if (currentSection.tasks.length > 0) {
          const doneCount = currentSection.tasks.filter(Boolean).length;
          const progress = Math.round((doneCount / currentSection.tasks.length) * 100);

          // Обновляем заголовок с прогрессом
          const headerIndex = currentSection.startIndex;
          const headerLine = result[headerIndex];
          const newHeader = headerLine.replace(/\s*-\s*\d+%\s*(?:done)?!?\s*✅?\s*$/, '') + 
            (progress === 100 ? ` - ${progress}% done! ✅` : ` - ${progress}% done!`);
          result[headerIndex] = newHeader;
        }
      }
    }

    result.push(line);
  }

  // Обрабатываем оставшиеся открытые разделы
  for (const currentSection of currentSections) {
    if (currentSection.tasks.length > 0) {
      const doneCount = currentSection.tasks.filter(Boolean).length;
      const progress = Math.round((doneCount / currentSection.tasks.length) * 100);

      // Обновляем заголовок с прогрессом
      const headerIndex = currentSection.startIndex;
      const headerLine = result[headerIndex];
      const newHeader = headerLine.replace(/\s*-\s*\d+%\s*(?:done)?!?\s*✅?\s*$/, '') + 
        (progress === 100 ? ` - ${progress}% done! ✅` : ` - ${progress}% done!`);
      result[headerIndex] = newHeader;
    }
  }

  return result;
}

// Основная функция
function main() {
  console.log('Обновление файла README...');
  
  // Читаем файл
  const content = readFile();
  const lines = content.split('\n');
  
  // Обновляем прогресс в заголовках
  const updatedLines = updateProgress(lines);
  
  // Собираем информацию о прогрессе всех разделов
  const sectionsProgress = collectSectionProgress(updatedLines);
  
  // Генерируем новое оглавление
  const toc = generateToc(updatedLines, sectionsProgress);
  
  // Вставляем новое оглавление
  const finalLines = [];
  let tocInserted = false;
  let inToc = false;
  
  for (const line of updatedLines) {
    if (line.startsWith('## Содержание')) {
      finalLines.push(toc);
      tocInserted = true;
      inToc = true;
      continue;
    }
    
    if (inToc && line.trim() === '') {
      inToc = false;
      continue;
    }
    
    if (!inToc) {
      finalLines.push(line);
    }
  }
  
  // Если оглавление не было вставлено, добавляем его в начало
  if (!tocInserted) {
    finalLines.unshift('', toc, '');
  }
  
  // Записываем обновленный файл
  writeFile(finalLines.join('\n'));
}

// Запускаем скрипт
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}