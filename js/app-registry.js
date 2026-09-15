/**
 * @file Глобальный реестр записей для модулей.
 * @description Обеспечивает единую точку входа (Singleton) для обмена
 * данными между изолированными JS-компонентами.
 * @version 0.1.0
 * @author Undead Medved {@link https://github.com/MedvedAndr GitHub}
 */

/*  =========================================================================
 *  TODO: Разработка реестра для хранения состояний, объектов и записей.
 *  =========================================================================
 *  Полноценный стабильный релиз
 *  [*] Реализация метода getAll()
 *      - метод получает и выводит все данные из реестра в виде объекта
 *  [*] Реализация метода has(path)
 *      - метод проверяет наличие указанного пути внутри реестра
 *      - вывод статуса наличия true/false
 *  [*] Реализация метода remove(path)
 *      - метод удаляет из реестра запись по указанному пути
 *      - вывод статуса успеха выполнения true/false
 *  [*] Реализация метода clear()
 *      - метод полностью очищает реестр от записей
 *      - вывод статуса успеха выполнения true/false
 *  [ ] Адаптировать код под TypeScript
 *  [ ] Релиз v1.0.0
 *
 *  Патчи
 *  [ ] Оптимизация кода
 *  [ ] Замена создания объектов с {} на Object.create(null)
 *  [ ] Внедрить запрещенные ключи
 *  [ ] Очистка ключей от окружающих пробелов
 *	[ ] Протестировать поведение методов при записи объектов как значений
 *
 *  Расширение возможностей
 *  [ ] Реализовать метод getHistory()
 *      - метод получает и выводит историю изменений реестра
 *      - сохранение детальной истории изменений (create, update, remove) выполняется внутри методов set() и remove() отдельным приватным методом
 *  [ ] Реализовать вызов триггеров событий (event triggers) при добавлении, изменении или удалении записей
 */

class AppRegistry {
	// Приватное хранилище данных
	#app_registry = {};

    /**
     * Конструктор класса
     * Всегда инициализирует чистый реестр для обеспечения модульного Singleton
     */
    constructor() {
        // Конструктор намеренно пуст. Данные вносятся строго через метод set()
    }

	/**
     * Добавляет значение в реестр по указанному пути
     * @param {string|string[]} path - Путь для записи
     * @param {*} value - Значение для записи
     * @returns {boolean} - Статус успеха операции
     */
    set(path, value) {
		const keys_list = #parsePathAndValidateEmpty(path, 'set');
        
        // Проверка, что путь не пустой
        if (!keys_list) return false;

		// Создаем "курсор" для навигации вглубь объекта. Содержит текущий уровень вложенности.
        let current_node = this.#app_registry;
        // Запоминаем индекс самого последнего ключа в пути
        const last_index = keys_list.length - 1;

        // Строим каркас: перебираем все промежуточные узлы строго до предпоследнего шага
        for (let i = 0; i < last_index; i++) {
            // Берем ключ текущего узла
            const k = keys_list[i];

            // Если такого узла еще нет — создаем пустой объект
            if (!Object.prototype.hasOwnProperty.call(current_node, k)) {
                current_node[k] = {};
            }
			// Если узел есть, проверяем его тип. Он обязан быть объектом (не строкой, не null, не массивом/списком)
            else if (
                typeof current_node[k] !== 'object' ||
                current_node[k] === null ||
                Array.isArray(current_node[k])
            ) {
                // Если там лежит не объект — это конфликт. Склеиваем пройденный путь для понятного сообщения
                const current_node_path = keys_list.slice(0, i + 1).join('.');
                console.warn(`AppRegistry.set(): Конфликт путей. Узел "${current_node_path}" не является объектом.`);

                // Запись заблокирована, аварийно выходим
                return false;
            }
            
            // Передвигаем "курсор" на один уровень вглубь
            current_node = current_node[k];
        }

		// Записываем переданное значение в самый последний ключ пути
        const last_key = keys_list[last_index];
        current_node[last_key] = value;

        // Возврат успешного выполнения записи
        return true;
	}

	/**
     * Получает значение из реестра по указанному пути
     * @param {string|string[]} path - Путь для получения значения
     * @param {*} [default_value=undefined] - Дефолтное значение, если путь не найден
     * @returns {*} - Возвращает найденное значение или default_value
     */
    get(path, default_value = undefined) {
		const keys_list = #parsePathAndValidateEmpty(path, 'get');
        
        // Проверка, что путь не пустой
        if (!keys_list) return false;
        
        const last_cursor = this.#getLastCursor(keys_list);
        
        if (last_cursor === null) {
            return default_value;
        }
        
        const last_index = keys_list.length - 1;
        const last_key = keys_list[last_index];
        
        if (!Object.prototype.hasOwnProperty.call(last_cursor, last_key)) {
            return default_value;
        }
        
        return last_cursor[last_key];
	}

	/**
     * Получает все значения из реестра
     * @returns {Object} - Возвращает глубокую изолированную копию данных реестра без прототипа
     */
    getAll() {
        return Object.assign(Object.create(null), structuredClone(this.#app_registry));
    }

	/**
     * Удаляет из реестра узел по указанному пути
     * @param {string|string[]} path - Путь для удаления узла
     * @returns {boolean} - Статус успеха операции
     */
    remove(path) {
        const keys_list = #parsePathAndValidateEmpty(path, 'remove');
        
        // Проверка, что путь не пустой
        if (!keys_list) return false;

		// Создаем "курсор" для навигации вглубь объекта. Содержит текущий уровень вложенности.
        let current_node = this.#app_registry;
		
		// Запускаем рекурсивное удаление
		return this.#checkForDelete(current_node, keys_list);
    }

	/**
     * Полностью очищает реестр от всех записей
     * @returns {boolean} - Статус успеха операции
     */
    clear() {
        // Заменяем старое хранилище новым чистым объектом
        this.#app_registry = Object.create(null);

        // Возврат успешного выполнения очистки
        return true;
    }

	/**
     * Проверяет наличие ключа по указанному пути
     * @param {string|string[]} path - Путь для проверки
     * @returns {boolean} - Статус наличия ключа
     */
    has(path) {
        const keys_list = #parsePathAndValidateEmpty(path, 'has');
        
        // Проверка, что путь не пустой
        if (!keys_list) return false;
        
        const last_cursor = this.#getLastCursor(keys_list);
        
        if (last_cursor === null) {
            return false;
        }
        
        const last_index = keys_list.length - 1;
        const last_key = keys_list[last_index];
        
        return Object.prototype.hasOwnProperty.call(last_cursor, last_key);
    }

	/**
     * Внутренний рекурсивный метод для удаления ключей и схлопывания пустых промежуточных узлов
     * @param {Object} current_node - Текущий уровень объекта
     * @param {string[]} keys_list - Массив ключей пути
     * @param {number} index - Текущий индекс обрабатываемого ключа
     * @returns {boolean} - Статус успеха операции
     */
    #checkForDelete(current_node, keys_list, index = 0) {
        const k = keys_list[index];
        const last_index = keys_list.length - 1;
        let status;

        // Если ключа изначально нет, то удалять нечего, возвращаем true
        if (!Object.prototype.hasOwnProperty.call(current_node, k)) {
            return true;
        }

        if (index < last_index) {
            // Проверяем безопасность типа перед погружением
            if (
                typeof current_node[k] !== 'object' ||
                current_node[k] === null ||
                Array.isArray(current_node[k])
            ) {
                const current_node_path = keys_list.slice(0, index + 1).join('.');
                console.warn(`AppRegistry.remove(): Конфликт путей. Узел "${current_node_path}" не является объектом.`);

                return false;
            }

            status = this.#checkForDelete(current_node[k], keys_list, index + 1);

            // Обратный ход рекурсии: если узел опустел — удаляем его из памяти
            if (Object.keys(current_node[k]).length === 0) {
                delete current_node[k];
            }
        }
        else {
            delete current_node[k];
            return true;
        }

        return status;
    }

	/**
     * Внутренний метод для безопасного поиска предфинального (родительского) узла
     * @param {string[]} keys_list - Массив очищенных ключей пути
     * @returns {Object|null} - Возвращает целевой объект вложенности или null при недостижимости пути / конфликте типов
     */
    #getLastCursor(keys_list) {
        // Создаем "курсор" для навигации вглубь объекта. Содержит текущий уровень вложенности.
        let current_node = this.#app_registry;
        // Запоминаем индекс самого последнего ключа в пути
        const last_index = keys_list.length - 1;

        // Перемещаемся вглубь, перебирая узлы строго до предпоследнего шага
        for (let i = 0; i < last_index; i++) {
            // Берем ключ текущего узла
            const k = keys_list[i];
            
            // Проверяем отсутствие текущего ключа в текущем узле
            if (!Object.prototype.hasOwnProperty.call(current_node, k)) {
                return null;
            }

            // Передвигаем "курсор" на один уровень вглубь
            current_node = current_node[k];
            
            // Проверка текущего узла на корректность типа
            if (
                typeof current_node !== 'object' ||
                current_node === null ||
                Array.isArray(current_node)
            ) {
                return null;
            }
        }

        return current_node;
    }

	/**
     * Внутренний метод парсит путь и проводит проверку на пустоту
     * @param {string|string[]} path - Путь (строка с точками или массив)
	 * @param {string} method - Метод, от имени которого вызвали проверку
     * @returns {string[]|null} - Массив ключей или null (если валидация не пройдена)
     */
	#parsePathAndValidateEmpty(path, method) {
        const keys_list = this.#parsePath(path);
        
        if (keys_list.length === 0) {
            console.warn(`AppRegistry.${method}(): Передан пустой путь.`);
            
            return null;
        }

        return keys_list;
    }

	/**
     * Внутренний метод для приведения любого пути к массиву ключей
     * @param {string|string[]} path - Путь (строка с точками или массив)
     * @returns {string[]} - Массив ключей
     */
    #parsePath(path) {
        let keys_list;

        // Если путь это не пустая строка, разделяем её по точке (поддержка точечной нотации)
        if (typeof path === 'string' && path.trim() !== '') {
            keys_list = path.split('.');
        }
        // Если путь это массив, то приводим все его элементы к строке (поддержка списка ключей)
        else if (Array.isArray(path) && path.length > 0) {
            keys_list = path.map(String);
        }
		// Все не поддерживаемые форматы пути вернут пустой массив
		else {
			keys_list = [];
		}

		// Очищаем конечный список от пустых ключей
        keys_list = keys_list.filter(key_item => key_item.trim() !== '');
		
        return keys_list;
    }
}

const appRegistry = new AppRegistry();

export { appRegistry };
