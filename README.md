# Beeps SteamHelper Backend (готово на 60%)
Бекенд-частина веб-додатку для аналізу Steam-профілів.

## Опис
Цей проєкт — серверна частина SteamHelper, яка обробляє авторизацію через Steam і надає дані про профілі та ігри через API. Розроблений для придбання практичних навичок у бекенд-розробці з NestJS.

## Технології
- **NestJS**: Модульна архітектура, REST API.
- **TypeScript**: Типізація для безпеки коду.
- **Steam API**: Інтеграція для авторизації та даних.
- **Axios**: HTTP-запити.
- **OpenAI API**: Генерація рекомендацій на основі LLM.

## Основний функціонал
- Ендпоінт `/auth/steam` для авторизації.
- Ендпоінти `/auth/profile/:steamId` і `/auth/games/:steamId` для даних профілю та ігор.
- Обробка помилок і кешування стану.

## Встановлення та запуск
1. Клонувати репозиторій:
   ```bash
   git clone https://github.com/beepstephan/beeps-steamhelper-backend.git
2. Встановити залежності:
   ```bash
   npm i
3. Створити .env із Steam API ключем:
   ```bash
   STEAM_API_KEY=your_key_here
   PORT=4200
4. Запустити:
   ```bash
   npm run start:dev