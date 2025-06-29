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
  const toc = [];
  const anchors = {};
  
  for (const line of lines) {
    const headerMatch = line.match(HEADER_REGEX);
    if (headerMatch) {
      const level = headerMatch[1].length;
      
      // Пропускаем заголовки первого уровня (# ...)
      if (level === 1) continue;
      
      const title = headerMatch[2];
      const anchor = generateAnchor(title);
      
      // Обработка дублирующихся якорей
      if (anchors[anchor]) {
        anchors[anchor]++;
        anchor = `${anchor}-${anchors[anchor]}`;
      } else {
        anchors[anchor] = 1;
      }
      
      // Добавляем отступы в зависимости от уровня заголовка
      const indent = '  '.repeat(level - 2);
      
      // Получаем прогресс для данного заголовка
      const progress = sectionsProgress[title];
      
      // Форматируем строку оглавления
      let tocLine = `${indent}- [`;
      
      // Если прогресс 100%, добавляем жирный шрифт и отметку о завершении
      if (progress === 100) {
        tocLine += `**${title} - ${progress}% done! ✅**`;
      } else if (progress) {
        tocLine += `${title} (${progress}%)`;
      } else {
        tocLine += title;
      }
      
      tocLine += `](#${anchor})`;
      toc.push(tocLine);
    }
  }
  
  return toc.join('\n');
}

// Функция для удаления существующих оглавлений
function removeExistingToc(lines) {
  const result = [];
  let skipUntilNextSection = false;
  let inToc = false;
  
  // Проверяем, является ли строка элементом оглавления
  function isTocItem(line) {
    // Шаблон для строк оглавления: "  - [Название](#якорь)"
    return /^\s*-\s+\[.*\]\(#.*\)/.test(line);
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Если находим заголовок "Содержание", начинаем пропускать строки
    if (line.startsWith('## Содержание')) {
      skipUntilNextSection = true;
      inToc = true;
      continue;
    }
    
    // Если мы в режиме пропуска (внутри оглавления)
    if (skipUntilNextSection) {
      // Если это пустая строка, проверяем следующую строку
      if (line.trim() === '') {
        // Проверяем, является ли следующая строка заголовком или элементом оглавления
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          // Если следующая строка - заголовок второго уровня или выше, или это не элемент оглавления,
          // значит оглавление закончилось
          if ((nextLine.startsWith('#') && !nextLine.startsWith('## Содержание')) || 
              (!isTocItem(nextLine) && nextLine.trim() !== '')) {
            skipUntilNextSection = false;
            inToc = false;
          }
        }
      }
      // Если это не пустая строка и не элемент оглавления, значит оглавление закончилось
      else if (!isTocItem(line) && !line.startsWith('-')) {
        skipUntilNextSection = false;
        inToc = false;
        // Добавляем эту строку, так как она уже не часть оглавления
        result.push(line);
      }
      
      // Пропускаем строки оглавления
      if (inToc) {
        continue;
      }
    }
    
    // Добавляем строку в результат, если мы не в оглавлении
    if (!inToc) {
      result.push(line);
    }
  }
  
  // Удаляем лишние пустые строки в начале и между разделами
  return cleanupEmptyLines(result);
}

// Функция для очистки лишних пустых строк
function cleanupEmptyLines(lines) {
  const result = [];
  let consecutiveEmptyLines = 0;
  
  for (const line of lines) {
    if (line.trim() === '') {
      consecutiveEmptyLines++;
      // Оставляем максимум 2 пустые строки подряд
      if (consecutiveEmptyLines <= 2) {
        result.push(line);
      }
    } else {
      consecutiveEmptyLines = 0;
      result.push(line);
    }
  }
  
  // Удаляем пустые строки в начале файла
  while (result.length > 0 && result[0].trim() === '') {
    result.shift();
  }
  
  return result;
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
  
  // Удаляем все существующие оглавления
  const cleanedLines = removeExistingToc(lines);
  
  // Обновляем прогресс в заголовках
  const updatedLines = updateProgress(cleanedLines);
  
  // Собираем информацию о прогрессе всех разделов
  const sectionsProgress = collectSectionProgress(updatedLines);
  
  // Генерируем новое оглавление
  const toc = generateToc(updatedLines, sectionsProgress);
  
  // Вставляем новое оглавление после заголовка первого уровня
  const finalLines = [];
  let tocInserted = false;
  
  // Ищем первый заголовок первого уровня
  for (let i = 0; i < updatedLines.length; i++) {
    const line = updatedLines[i];
    
    // Добавляем строку в результат
    finalLines.push(line);
    
    // Если это первый заголовок первого уровня
    if (!tocInserted && line.startsWith('# ')) {
      // Ищем первую пустую строку после заголовка
      if (i + 1 < updatedLines.length && updatedLines[i + 1].trim() === '') {
        // Вставляем оглавление после заголовка и пустой строки
        finalLines.push('');
        finalLines.push('## Содержание');
        finalLines.push('');
        finalLines.push(toc);
        finalLines.push('');
        tocInserted = true;
        i++; // Пропускаем пустую строку, так как мы её уже добавили
      } else {
        // Если нет пустой строки, добавляем её
        finalLines.push('');
        finalLines.push('## Содержание');
        finalLines.push('');
        finalLines.push(toc);
        finalLines.push('');
        tocInserted = true;
      }
    }
  }
  
  // Если оглавление не было вставлено (например, если нет заголовка первого уровня),
  // добавляем его в начало
  if (!tocInserted) {
    finalLines.unshift('## Содержание', '', toc, '');
  }
  
  // Записываем обновленный файл
  writeFile(finalLines.join('\n'));
}

// Запускаем скрипт
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}