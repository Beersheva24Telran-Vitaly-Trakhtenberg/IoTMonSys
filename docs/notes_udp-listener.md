# Добавление HTTP-сервера для API в UDP Listener

Почему добавляем API в UDP Listener, а не только в backend:
1. Независимость микросервисов:
* Каждый микросервис должен быть независимым и самодостаточным. 
* UDP Listener должен иметь возможность управлять своим режимом обнаружения без зависимости от backend
2. Локальное управление функциональностью:
* Режим обнаружения - это функция именно UDP Listener
* Логично, чтобы и управление этой функцией было реализовано в этом же сервисе
3. Упрощение архитектуры:
* Не нужно создавать дополнительные каналы связи между сервисами
* Нет необходимости в очередях сообщений или других механизмах для передачи команд

## Как это будет работать в общей архитектуре:
1. UDP Listener предоставляет свой локальный API для:
* Включения/выключения режима обнаружения
* Получения статуса режима обнаружения
2. Backend может взаимодействовать с этим API:
* Вызывать эндпоинты UDP Listener для управления режимом обнаружения
* Предоставлять свой API для фронтенда, который будет проксировать запросы к UDP Listener
3. Frontend взаимодействует с backend API:
* Пользователь нажимает кнопку "Обнаружить устройства" на интерфейсе
* Frontend отправляет запрос к backend
* Backend проксирует запрос к UDP Listener
* UDP Listener включает режим обнаружения

Такой подход полностью соответствует принципам микросервисной архитектуры и позволяет каждому сервису сохранять свою автономность, при этом обеспечивая необходимое взаимодействие между компонентами системы.