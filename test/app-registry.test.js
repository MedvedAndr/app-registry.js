import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AppRegistry, appRegistry } from '../js/app-registry.js';

describe('AppRegistry', () => {
	let registry;

	beforeEach(() => {
		registry = new AppRegistry();
	});

	afterEach(() => {
		mock.restoreAll();
	});

	describe('экспорт', () => {
		it('отдаёт класс и синглтон', () => {
			assert.equal(typeof AppRegistry, 'function');
			assert.ok(appRegistry instanceof AppRegistry);
		});

		it('создаёт изолированные экземпляры', () => {
			const first_registry = new AppRegistry();
			const second_registry = new AppRegistry();

			assert.equal(first_registry.set('user.name', 'Анна'), true);
			assert.equal(first_registry.get('user.name'), 'Анна');
			assert.equal(second_registry.get('user.name'), undefined);
		});
	});

	describe('set и get', () => {
		it('записывает и читает значение по точечному пути', () => {
			assert.equal(registry.set('user.name', 'Анна'), true);
			assert.equal(registry.get('user.name'), 'Анна');
		});

		it('записывает и читает значение по массиву ключей', () => {
			assert.equal(registry.set(['user', 'age'], 30), true);
			assert.equal(registry.get(['user', 'age']), 30);
		});

		it('считает строковый и массивовый путь одним местом', () => {
			registry.set('user.city', 'Томск');
			assert.equal(registry.get(['user', 'city']), 'Томск');
		});

		it('перезаписывает значение по тому же пути', () => {
			registry.set('flag', true);
			assert.equal(registry.set('flag', false), true);
			assert.equal(registry.get('flag'), false);
		});

		it('сохраняет разные типы значений', () => {
			registry.set('empty', '');
			registry.set('zero', 0);
			registry.set('off', false);
			registry.set('none', null);
			registry.set('list', [1, 2]);
			registry.set('data', { ok: true });

			assert.equal(registry.get('empty'), '');
			assert.equal(registry.get('zero'), 0);
			assert.equal(registry.get('off'), false);
			assert.equal(registry.get('none'), null);
			assert.deepEqual(registry.get('list'), [1, 2]);
			assert.deepEqual(registry.get('data'), { ok: true });
		});
	});

	describe('нормализация пути', () => {
		it('убирает пробелы и пустые сегменты', () => {
			assert.equal(registry.set(' user..name ', 'Анна'), true);
			assert.equal(registry.get('user.name'), 'Анна');
			assert.equal(registry.get([' user ', '', 'name ']), 'Анна');
		});

		it('отклоняет неподдерживаемый формат пути в set', () => {
			const warn = mock.method(console, 'warn', () => {});

			assert.equal(registry.set(null, 1), false);
			assert.equal(registry.set(undefined, 1), false);
			assert.equal(registry.set(42, 1), false);
			assert.equal(registry.set({ key: 'user' }, 1), false);
			assert.equal(warn.mock.callCount(), 4);
		});
	});

	describe('пустой путь', () => {
		it('отклоняет пустой путь в set и предупреждает', () => {
			const warn = mock.method(console, 'warn', () => {});

			assert.equal(registry.set('', 1), false);
			assert.equal(registry.set('   ', 1), false);
			assert.equal(registry.set([], 1), false);
			assert.equal(registry.set(['', '  '], 1), false);
			assert.equal(warn.mock.callCount(), 4);
			assert.match(warn.mock.calls[0].arguments[0], /пустой путь/i);
		});

		it('возвращает дефолт и предупреждает в get', () => {
			const warn = mock.method(console, 'warn', () => {});

			assert.equal(registry.get('', 'нет'), 'нет');
			assert.equal(registry.get('   '), undefined);
			assert.equal(registry.get([]), undefined);
			assert.equal(warn.mock.callCount(), 3);
			assert.match(warn.mock.calls[0].arguments[0], /пустой путь/i);
		});
	});

	describe('недопустимые ключи', () => {
		it('блокирует запись через __proto__, prototype и constructor', () => {
			const warn = mock.method(console, 'warn', () => {});

			assert.equal(registry.set('__proto__.polluted', true), false);
			assert.equal(registry.set('prototype.x', 1), false);
			assert.equal(registry.set(['user', 'constructor'], 1), false);
			assert.equal(warn.mock.callCount(), 3);
			assert.match(warn.mock.calls[0].arguments[0], /недопустимый ключ/i);
		});

		it('не читает недопустимый путь и не пишет в Object.prototype', () => {
			assert.equal(registry.get('__proto__.polluted', 'нет'), 'нет');
			assert.equal(registry.get(['constructor'], 'нет'), 'нет');
			assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false);
		});
	});

	describe('конфликт типов', () => {
		it('не пишет вглубь, если узел уже не объект', () => {
			const warn = mock.method(console, 'warn', () => {});

			registry.set('user', 'строка');

			assert.equal(registry.set('user.name', 'Анна'), false);
			assert.equal(registry.get('user'), 'строка');
			assert.equal(registry.get('user.name', 'нет'), 'нет');
			assert.equal(warn.mock.callCount(), 1);
			assert.match(warn.mock.calls[0].arguments[0], /не является объектом/i);
		});

		it('считает конфликтом null и массив на промежуточном узле', () => {
			mock.method(console, 'warn', () => {});

			registry.set('profile', null);
			assert.equal(registry.set('profile.city', 'Томск'), false);

			registry.set('tags', ['a']);
			assert.equal(registry.set('tags.item', 'b'), false);
		});

		it('возвращает дефолт, если промежуточный узел нельзя обойти', () => {
			registry.set('user', 10);

			assert.equal(registry.get('user.name', 'нет'), 'нет');
		});
	});

	describe('дефолт в get', () => {
		it('возвращает undefined, если пути нет и дефолт не задан', () => {
			assert.equal(registry.get('missing.path'), undefined);
		});

		it('возвращает переданный дефолт для отсутствующего пути', () => {
			assert.equal(registry.get('missing.path', 'нет'), 'нет');
			assert.equal(registry.get(['missing', 'path'], 0), 0);
		});
	});
});
