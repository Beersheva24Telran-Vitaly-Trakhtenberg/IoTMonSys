# Настройка и использование AWS Kinesis в IoTMonSys

## Обзор

AWS Kinesis Data Streams используется в IoTMonSys для потоковой передачи данных от устройств в реальном времени. Это позволяет Lambda-функциям, таким как ErrorPollerHandler, обрабатывать данные и реагировать на события (например, низкий заряд батареи) своевременно.

## Конфигурация

### Переменные окружения

Для работы с Kinesis необходимо настроить следующие переменные окружения в файле `.env`:

```
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
KINESIS_STREAM_NAME=IoTMonSys-DeviceData

# Kinesis Usage Flag
USE_KINESIS=true

# CloudWatch Configuration (опционально)
AWS_CLOUDWATCH_ENABLED=false
AWS_CLOUDWATCH_GROUP=IoTMonSys-udp-listener
```

> **Примечание**: Для локальной разработки используются AWS ключи доступа. В продакшен-среде рекомендуется использовать IAM-роли вместо ключей доступа.

### Поток данных Kinesis

1. Создайте поток данных Kinesis в AWS Console:
   - Имя потока: `IoTMonSys-DeviceData` (должно совпадать с переменной `KINESIS_STREAM_NAME`)
   - Режим ёмкости: On-demand (рекомендуется для начала)
   - Количество шардов: 1 (можно увеличить при необходимости)

2. Убедитесь, что у вашего AWS пользователя или роли есть следующие разрешения:
   - `kinesis:PutRecord`
   - `kinesis:PutRecords`
   - `kinesis:DescribeStream`

## Интеграция с Lambda

### ErrorPollerHandler

Lambda-функция ErrorPollerHandler настроена для мониторинга устройств с низким зарядом батареи. Она:

1. Проверяет устройства на неактивность (не отправляли данные более 24 часов)
2. Проверяет устройства с батарейным питанием на низкий заряд (ниже 20%)
3. Отправляет уведомления через SNSHelper
4. Устанавливает флаги `offlineAlertSent` и `lowBatteryAlertSent` для предотвращения повторных уведомлений

### Формат данных

Данные, отправляемые в Kinesis, должны содержать следующие поля для корректной работы с батарейными устройствами:

```json
{
  "deviceId": "device123",
  "type": "temperature",
  "value": 25.5,
  "timestamp": "2025-06-25T09:30:00.000Z",
  "batteryLevel": 75,
  "powerType": "battery",
  "referenceVoltage": 3.7
}
```

## Интеграция с CloudWatch

В текущей конфигурации интеграция с CloudWatch отключена (`AWS_CLOUDWATCH_ENABLED=false`). Это сделано для экономии ресурсов на этапе разработки.

### Включение CloudWatch

Для включения отправки логов в CloudWatch:

1. Измените переменную `AWS_CLOUDWATCH_ENABLED=true` в файле `.env`
2. Убедитесь, что указана правильная лог-группа в `AWS_CLOUDWATCH_GROUP`
3. Проверьте, что у AWS пользователя есть права на создание и запись в CloudWatch Logs

### Рекомендуемые метрики для мониторинга

При настройке CloudWatch рекомендуется отслеживать следующие метрики:

1. **Kinesis Data Streams**:
   - `PutRecord.Success` - успешные записи в поток
   - `WriteProvisionedThroughputExceeded` - превышение пропускной способности
   - `GetRecords.IteratorAgeMilliseconds` - возраст итератора (задержка обработки)

2. **Lambda-функции**:
   - `Invocations` - количество вызовов
   - `Errors` - количество ошибок
   - `Duration` - время выполнения

## Отладка

1. Проверьте логи в CloudWatch для компонентов:
   - UDP Listener
   - Kinesis Data Streams
   - Lambda-функции

2. Распространенные проблемы:
   - Неверные учетные данные AWS
   - Отсутствие прав доступа
   - Неправильное имя потока
   - Ошибки в формате данных

## Мониторинг

Рекомендуется настроить CloudWatch Alarms для мониторинга:
- Задержки обработки записей (Iterator Age)
- Ошибок отправки (PutRecord.Success)
- Задержек Lambda-функций (Duration)

## Оптимизация затрат

Для оптимизации затрат на AWS сервисы:

1. Используйте режим On-demand для Kinesis только при низких объемах данных
2. Включайте CloudWatch только при необходимости мониторинга
3. Создавайте дашборды CloudWatch только для продакшен-среды
4. Настраивайте алармы только для критических метрик

## AWS Kinesis Setup для IoTMonSys

### Настройка потока Kinesis Data Streams

1. Создайте поток Kinesis Data Streams с именем `IoTMonSys-DeviceData`:
   ```bash
   aws kinesis create-stream --stream-name IoTMonSys-DeviceData --shard-count 1
   ```

2. Проверьте статус потока:
   ```bash
   aws kinesis describe-stream --stream-name IoTMonSys-DeviceData
   ```

3. Для просмотра данных в потоке:
   ```bash
   # Получение итератора шарда
   aws kinesis get-shard-iterator --stream-name IoTMonSys-DeviceData --shard-id shardId-000000000000 --shard-iterator-type TRIM_HORIZON
   
   # Чтение записей с использованием полученного итератора
   aws kinesis get-records --shard-iterator <полученный-итератор>
   ```

## Настройка IAM политик

### Минимальные права для отправки данных в Kinesis

Для пользователя `IoTMonSys@ApiClient.7125` необходимо создать следующую политику:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "kinesis:PutRecord",
                "kinesis:PutRecords",
                "kinesis:DescribeStream"
            ],
            "Resource": "arn:aws:kinesis:us-east-1:394163297125:stream/IoTMonSys-DeviceData"
        }
    ]
}
```

Эти разрешения позволяют:
- `kinesis:PutRecord` - отправлять отдельные записи в поток
- `kinesis:PutRecords` - отправлять пакеты записей (для оптимизации)
- `kinesis:DescribeStream` - получать информацию о потоке (для диагностики)

### Добавление политики к существующему пользователю

1. Войдите в консоль AWS
2. Перейдите в раздел IAM
3. Выберите "Policies" (Политики)
4. Найдите политику `IoTMonSys-ApiClientPolicies`
5. Нажмите "Edit policy" (Редактировать политику)
6. Добавьте новый блок Statement с разрешениями Kinesis
7. Сохраните изменения

## Конфигурация в приложении

В файле `.env` должны быть настроены следующие переменные:

```
USE_KINESIS=true
KINESIS_STREAM_NAME=IoTMonSys-DeviceData
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<ID ключа доступа>
AWS_SECRET_ACCESS_KEY=<Секретный ключ доступа>
```

## Отладка проблем с Kinesis

### Проверка логов

Логи Kinesis сервиса находятся в директории `./logs/kinesis-service/`.

### Типичные ошибки

1. **AccessDeniedException**: Пользователь не имеет необходимых разрешений. Проверьте IAM политику.
2. **ResourceNotFoundException**: Указанный поток не существует. Проверьте имя потока и регион.
3. **ProvisionedThroughputExceededException**: Превышен лимит пропускной способности. Увеличьте количество шардов или реализуйте механизм повторных попыток.

### Проверка данных в потоке

```bash
# Получение итератора шарда
aws kinesis get-shard-iterator --stream-name IoTMonSys-DeviceData --shard-id shardId-000000000000 --shard-iterator-type LATEST

# Чтение последних записей
aws kinesis get-records --shard-iterator <полученный-итератор>
```

## Дополнительные ресурсы

- [AWS Kinesis Documentation](https://docs.aws.amazon.com/kinesis/latest/dev/introduction.html)
- [AWS IAM Documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html)
