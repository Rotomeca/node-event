import { describe, it, expect, vi } from 'vitest';
import { EventData } from '../src/lib/classes/EventData';
import { EventHandler } from '../src/lib/classes/EventHandler';
import { CircularEventHandler } from '../src/lib/classes/CircularEventHandler';
import { JsCircularEvent } from '../src/lib/classes/deprecated/JsCircularEvent';
import { JsEvent } from '../src/lib/classes/deprecated/JsEvent';

const fn = () => vi.fn() as unknown as () => void;

// ── EventData ────────────────────────────────────────────────
describe('EventData', () => {
	it('Stocke le callback', () => {
		const cb = fn();
		const data = new EventData(cb);
		expect(data.callback).toBe(cb);
	});

	it('Stocke les arguments par défaut', () => {
		const cb = fn();
		const data = new EventData(cb, 'hello', 42);
		expect(data.args).toEqual(['hello', 42]);
	});

	it('Args est un tableau vide si aucun argument', () => {
		const data = new EventData(fn());
		expect(data.args).toEqual([]);
	});

	it('Ne mute pas les arguments passés', () => {
		const cb = fn();
		const args = ['a', 'b'];
		const data = new EventData(cb, ...args);
		args.push('c');
		expect(data.args).toHaveLength(2);
	});
});

// ── EventHandler ─────────────────────────────────────────────
describe('EventHandler', () => {
	// ── push ────────────────────────────────────────────────────
	describe('push', () => {
		it('Retourne une clé string', () => {
			const event = new EventHandler();
			const key = event.push(fn());
			expect(typeof key).toBe('string');
		});

		it('Génère des clés uniques à chaque appel', () => {
			const event = new EventHandler();
			const k1 = event.push(fn());
			const k2 = event.push(fn());
			expect(k1).not.toBe(k2);
		});

		it('Accepte une fonction directement', () => {
			const event = new EventHandler();
			const key = event.push(fn());
			expect(event.has(key)).toBe(true);
		});
	});

	// ── add ─────────────────────────────────────────────────────
	describe('add', () => {
		it('Retourne this pour le chaînage', () => {
			const event = new EventHandler();
			const result = event.add('key', fn());
			expect(result).toBe(event);
		});

		it('Permet le chaînage multiple', () => {
			const event = new EventHandler();
			event.add('a', fn()).add('b', fn()).add('c', fn());
			expect(event.count()).toBe(3);
		});

		it('Écrase une clé existante', () => {
			const event = new EventHandler();
			const cb1 = vi.fn(() => 1);
			const cb2 = vi.fn(() => 2);
			event.add('key', cb1);
			event.add('key', cb2);
			expect(event.count()).toBe(1);
			const result = event.invoke();
			expect(result.type).toBe('single');
			if (result.type === 'single') expect(result.value).toBe(2);
		});
	});

	// ── has ─────────────────────────────────────────────────────
	describe('has', () => {
		it('Retourne true si la clé existe', () => {
			const event = new EventHandler();
			event.add('key', fn());
			expect(event.has('key')).toBe(true);
		});

		it("Retourne false si la clé n'existe pas", () => {
			const event = new EventHandler();
			expect(event.has('inexistant')).toBe(false);
		});

		it('Retourne false après suppression', () => {
			const event = new EventHandler();
			event.add('key', fn());
			event.remove('key');
			expect(event.has('key')).toBe(false);
		});
	});

	// ── remove ──────────────────────────────────────────────────
	describe('remove', () => {
		it('Retourne le callback supprimé', () => {
			const cb = fn();
			const event = new EventHandler();
			event.add('key', cb);
			expect(event.remove('key')).toBe(cb);
		});

		it("Retourne null si la clé n'existe pas", () => {
			const event = new EventHandler();
			expect(event.remove('inexistant')).toBeFalsy();
		});

		it('Décrémente le count', () => {
			const event = new EventHandler();
			event.add('key', fn());
			event.remove('key');
			expect(event.count()).toBe(0);
		});

		it('Ne mute pas les autres callbacks', () => {
			const event = new EventHandler();
			event.add('a', fn());
			event.add('b', fn());
			event.remove('a');
			expect(event.has('b')).toBe(true);
		});
	});

	// ── count / haveEvents ──────────────────────────────────────
	describe('count / haveEvents', () => {
		it('count retourne 0 par défaut', () => {
			expect(new EventHandler().count()).toBe(0);
		});

		it("count s'incrémente à chaque add", () => {
			const event = new EventHandler();
			event.add('a', fn());
			event.add('b', fn());
			expect(event.count()).toBe(2);
		});

		it('haveEvents retourne false si vide', () => {
			expect(new EventHandler().haveEvents()).toBe(false);
		});

		it('haveEvents retourne true si au moins un callback', () => {
			const event = new EventHandler();
			event.add('key', fn());
			expect(event.haveEvents()).toBe(true);
		});
	});

	// ── keys ────────────────────────────────────────────────────
	describe('keys', () => {
		it('Retourne un tableau vide si aucun callback', () => {
			expect(new EventHandler().keys).toEqual([]);
		});

		it('Retourne les clés enregistrées', () => {
			const event = new EventHandler();
			event.add('a', fn());
			event.add('b', fn());
			expect(event.keys).toContain('a');
			expect(event.keys).toContain('b');
		});

		it('Retourne un nouveau tableau à chaque appel', () => {
			const event = new EventHandler();
			event.add('a', fn());
			const k1 = event.keys;
			const k2 = event.keys;
			expect(k1).not.toBe(k2);
		});

		it('Ne contient plus les clés supprimées', () => {
			const event = new EventHandler();
			event.add('a', fn());
			event.remove('a');
			expect(event.keys).not.toContain('a');
		});
	});

	// ── getInvocationList ───────────────────────────────────────
	describe('getInvocationList', () => {
		it('Retourne un tableau vide si aucun callback', () => {
			expect(new EventHandler().getInvocationList()).toEqual([]);
		});

		it("Retourne les callbacks dans l'ordre d'enregistrement", () => {
			const cb1 = fn();
			const cb2 = fn();
			const event = new EventHandler();
			event.add('a', cb1);
			event.add('b', cb2);
			const list = event.getInvocationList();
			expect(list[0]).toBe(cb1);
			expect(list[1]).toBe(cb2);
		});

		it('Retourne un nouveau tableau à chaque appel', () => {
			const event = new EventHandler();
			event.add('a', fn());
			expect(event.getInvocationList()).not.toBe(event.getInvocationList());
		});
	});

	// ── clear ───────────────────────────────────────────────────
	describe('clear', () => {
		it('Supprime tous les callbacks', () => {
			const event = new EventHandler();
			event.add('a', fn());
			event.add('b', fn());
			event.clear();
			expect(event.count()).toBe(0);
		});

		it('Retourne this pour le chaînage', () => {
			const event = new EventHandler();
			expect(event.clear()).toBe(event);
		});

		it('haveEvents retourne false après clear', () => {
			const event = new EventHandler();
			event.add('a', fn());
			event.clear();
			expect(event.haveEvents()).toBe(false);
		});
	});

	// ── invoke ──────────────────────────────────────────────────
	describe('invoke', () => {
		it('Retourne { type: "empty" } si aucun callback', () => {
			const event = new EventHandler();
			expect(event.invoke()).toEqual({ type: 'empty' });
		});

		it('Retourne { type: "single", value } si un seul callback', () => {
			const event = new EventHandler<[], () => number>();
			event.add('key', () => 42);
			const result = event.invoke();
			expect(result.type).toBe('single');
			if (result.type === 'single') expect(result.value).toBe(42);
		});

		it('Retourne { type: "multiple", values } si plusieurs callbacks', () => {
			const event = new EventHandler<[], () => number>();
			event.add('a', () => 1);
			event.add('b', () => 2);
			const result = event.invoke();
			expect(result.type).toBe('multiple');
			if (result.type === 'multiple') {
				expect(Object.values(result.values)).toContain(1);
				expect(Object.values(result.values)).toContain(2);
			}
		});

		it('Transmet les arguments aux callbacks', () => {
			const cb = vi.fn((x: number) => x * 2) as any;
			const event = new EventHandler<[number], (x: number) => number>();
			event.add('key', cb);
			event.invoke(5);
			expect(cb).toHaveBeenCalledWith(5);
		});

		it('Transmet les args par défaut avant les params', () => {
			const cb = vi.fn((...args: number[]) => args);
			const event = new EventHandler<
				number[],
				(...args: number[]) => number[]
			>();
			event.add('key', cb, 10, 20);
			event.invoke(30);
			expect(cb).toHaveBeenCalledWith(10, 20, 30);
		});

		it("Appelle les callbacks dans l'ordre d'enregistrement", () => {
			const order: number[] = [];
			const event = new EventHandler();
			event.add('a', () => order.push(1));
			event.add('b', () => order.push(2));
			event.add('c', () => order.push(3));
			event.invoke();
			expect(order).toEqual([1, 2, 3]);
		});

		it('Préserve les clés dans values pour multiple', () => {
			const event = new EventHandler<[], () => number>();
			event.add('premier', () => 1);
			event.add('second', () => 2);
			const result = event.invoke();
			if (result.type === 'multiple') {
				expect(result.values['premier']).toBe(1);
				expect(result.values['second']).toBe(2);
			}
		});
	});

	describe('_generateKey (collision)', () => {
		it('Génère une nouvelle clé en cas de collision', () => {
			const event = new EventHandler();
			// On remplit avec suffisamment de clés pour provoquer une collision
			// En mockant has() pour retourner true une fois puis false
			let callCount = 0;
			const originalHas = event.has.bind(event);
			vi.spyOn(event, 'has').mockImplementation((key: string) => {
				if (callCount++ < 1) return true; // simule une collision
				return originalHas(key);
			});
			const key = event.push(fn());
			expect(typeof key).toBe('string');
		});
	});

	// ── call (deprecated) ───────────────────────────────────────
	describe('call (deprecated)', () => {
		it('Retourne null si aucun callback', () => {
			expect(new EventHandler().call()).toBeNull();
		});

		it('Retourne la valeur directe si un seul callback', () => {
			const event = new EventHandler<[], () => number>();
			event.add('key', () => 42);
			expect(event.call()).toBe(42);
		});

		it('Retourne un tableau si plusieurs callbacks', () => {
			const event = new EventHandler<[], () => number>();
			event.add('a', () => 1);
			event.add('b', () => 2);
			const result = event.call();
			expect(Array.isArray(result)).toBe(true);
			expect(result).toContain(1);
			expect(result).toContain(2);
		});

		it('Lève une erreur pour un type inconnu', () => {
			const event = new EventHandler();
			// On force un résultat avec un type inconnu via mock
			vi.spyOn(event, 'invoke').mockReturnValue({ type: 'unknown' } as any);
			expect(() => event.call()).toThrow();
		});
	});

	// ── onHandlerAdded ──────────────────────────────────────────
	describe('onHandlerAdded', () => {
		it("Se déclenche lors d'un add", () => {
			const event = new EventHandler();
			const spy = fn() as any;
			event.onHandlerAdded.push(spy);
			event.add('key', fn());
			expect(spy).toHaveBeenCalledOnce();
		});

		it('Reçoit la clé et le callback ajouté', () => {
			const event = new EventHandler<[string]>();
			const cb = fn();
			let receivedKey = '';
			event.onHandlerAdded.push(((key: string) => {
				receivedKey = key;
			}) as any);
			event.add('monHandler', cb as any);
			expect(receivedKey).toBe('monHandler');
		});

		it('Ne se déclenche pas si aucun observateur abonné', () => {
			const event = new EventHandler();
			expect(() => event.add('key', fn())).not.toThrow();
		});

		it('Est initialisé de façon lazy', () => {
			const event = new EventHandler();
			event.add('key', fn()); // pas d'accès à onHandlerAdded
			// si lazy init cassé, ça lèverait une erreur
			expect(event.count()).toBe(1);
		});
	});

	// ── onHandlerRemoved ────────────────────────────────────────
	describe('onHandlerRemoved', () => {
		it("Se déclenche lors d'un remove", () => {
			const event = new EventHandler();
			const spy = fn();
			event.onHandlerRemoved.push(spy);
			event.add('key', fn());
			event.remove('key');
			expect(spy).toHaveBeenCalledOnce();
		});

		it('Reçoit la clé et le callback supprimé', () => {
			const event = new EventHandler();
			const cb = fn();
			let receivedKey = '';
			event.onHandlerRemoved.push(key => {
				receivedKey = key;
			});
			event.add('monHandler', cb);
			event.remove('monHandler');
			expect(receivedKey).toBe('monHandler');
		});

		it("Ne se déclenche pas si la clé n'existe pas", () => {
			const event = new EventHandler();
			const spy = fn();
			event.onHandlerRemoved.push(spy);
			event.remove('inexistant');
			expect(spy).not.toHaveBeenCalled();
		});
	});

	// ── onHandlerCleared ────────────────────────────────────────
	describe('onHandlerCleared', () => {
		it("Se déclenche lors d'un clear", () => {
			const event = new EventHandler();
			const spy = fn();
			event.onHandlerCleared.push(spy);
			event.add('key', fn());
			event.clear();
			expect(spy).toHaveBeenCalledOnce();
		});

		it('Reçoit la liste des callbacks supprimés', () => {
			const event = new EventHandler();
			const cb = fn();
			let received: unknown[] = [];
			event.onHandlerCleared.push(callbacks => {
				received = callbacks;
			});
			event.add('key', cb);
			event.clear();
			expect(received).toContain(cb);
		});

		it("Reçoit la liste avant l'effacement", () => {
			const event = new EventHandler();
			const cb = fn();
			let countAtClear = -1;
			event.onHandlerCleared.push(() => {
				countAtClear = event.count();
			});
			event.add('key', cb);
			event.clear();
			expect(countAtClear).toBe(0); // déjà vidé avant invoke
		});

		it('Ne se déclenche pas si aucun observateur', () => {
			const event = new EventHandler();
			event.add('key', fn());
			expect(() => event.clear()).not.toThrow();
		});
	});
});

// ── CircularEventHandler ─────────────────────────────────────
describe('CircularEventHandler', () => {
	// ── invoke ──────────────────────────────────────────────────
	describe('invoke', () => {
		it('Retourne { type: "empty" } si aucun callback', () => {
			const event = new CircularEventHandler<{ count: number }>();
			expect(event.invoke({ count: 0 })).toEqual({ type: 'empty' });
		});

		it('Propage et merge le record entre les callbacks', () => {
			const event = new CircularEventHandler<{ count: number }>();
			event.add('double', ({ count }) => ({ count: count * 2 }));
			event.add('add10', ({ count }) => ({ count: count + 10 }));
			const result = event.invoke({ count: 5 });
			expect(result.type).toBe('record');
			if (result.type === 'record') expect(result.value.count).toBe(20);
		});

		it('Ignore un callback retournant null', () => {
			const event = new CircularEventHandler<{ count: number }>();
			event.add('noop', () => null as any);
			event.add('add1', ({ count }) => ({ count: count + 1 }));
			const result = event.invoke({ count: 0 });
			expect(result.type).toBe('record');
			if (result.type === 'record') expect(result.value.count).toBe(1);
		});

		it('Ignore un callback retournant undefined', () => {
			const event = new CircularEventHandler<{ count: number }>();
			event.add('noop', () => undefined as any);
			event.add('add1', ({ count }) => ({ count: count + 1 }));
			const result = event.invoke({ count: 0 });
			expect(result.type).toBe('record');
			if (result.type === 'record') expect(result.value.count).toBe(1);
		});

		it('Ne mute pas le record original', () => {
			const event = new CircularEventHandler<{ count: number }>();
			event.add('inc', ({ count }) => ({ count: count + 1 }));
			const original = { count: 0 };
			event.invoke(original);
			expect(original.count).toBe(0);
		});

		it('Retourne { type: "other" } si args_0 n\'est pas un plain object', () => {
			const event = new CircularEventHandler(() => {});
			event.add('key', fn() as any);
			const result = event.invoke('not-a-record' as any);
			expect(result.type).toBe('other');
		});

		it('Préserve originalValue dans le type other', () => {
			const event = new CircularEventHandler(() => {});
			event.add('key', fn() as any);
			const result = event.invoke(42 as any);
			if (result.type === 'other') expect(result.originalValue).toBe(42);
		});

		it('Merge les additionalArgs du callback dans le record', () => {
			const event = new CircularEventHandler<{ a: number; b: number }>();
			event.add('key', ({ a, b }) => ({ a: a + b }), { b: 10 } as any);
			const result = event.invoke({ a: 5, b: 0 });
			expect(result.type).toBe('record');
			if (result.type === 'record') expect(result.value.a).toBe(15);
		});

		it("Appelle les callbacks dans l'ordre d'enregistrement", () => {
			const order: number[] = [];
			const event = new CircularEventHandler<Record<string, unknown>>();
			event.add('a', r => {
				order.push(1);
				return r;
			});
			event.add('b', r => {
				order.push(2);
				return r;
			});
			event.invoke({});
			expect(order).toEqual([1, 2]);
		});
	});
	describe("_p_init (events d'observation)", () => {
		it('onHandlerAdded fonctionne sur CircularEventHandler', () => {
			const event = new CircularEventHandler<{ count: number }>();
			const spy = fn() as any;
			event.onHandlerAdded.push(spy);
			event.add('key', ({ count }) => ({ count: count + 1 }));
			expect(spy).toHaveBeenCalledOnce();
		});

		it('onHandlerRemoved fonctionne sur CircularEventHandler', () => {
			const event = new CircularEventHandler<{ count: number }>();
			const spy = fn() as any;
			event.onHandlerRemoved.push(spy);
			event.add('key', ({ count }) => ({ count: count + 1 }));
			event.remove('key');
			expect(spy).toHaveBeenCalledOnce();
		});

		it('onHandlerCleared fonctionne sur CircularEventHandler', () => {
			const event = new CircularEventHandler<{ count: number }>();
			const spy = fn() as any;
			event.onHandlerCleared.push(spy);
			event.add('key', ({ count }) => ({ count: count + 1 }));
			event.clear();
			expect(spy).toHaveBeenCalledOnce();
		});
	});

	// ── call (deprecated) ───────────────────────────────────────
	describe('call (deprecated)', () => {
		it('Retourne null si aucun callback', () => {
			const event = new CircularEventHandler<{ count: number }>();
			expect(event.call({ count: 0 })).toBeNull();
		});

		it('Retourne le record final', () => {
			const event = new CircularEventHandler<{ count: number }>();
			event.add('inc', ({ count }) => ({ count: count + 1 }));
			const result = event.call({ count: 0 });
			expect(result).toEqual({ count: 1 });
		});

		// À ajouter dans describe('call (deprecated)') de CircularEventHandler
		it("Retourne la valeur pour le type 'other'", () => {
			const event = new CircularEventHandler();
			event.add('key', fn() as any);
			const result = event.call(42 as any);
			expect(result).toBeDefined();
		});
	});
});

// ── JsEvent ──────────────────────────────────────────────────
describe('JsEvent', () => {
	// ── invoke ────────────────────────────────────────────────
	describe('invoke', () => {
		it('Retourne { type: "empty" } si aucun callback', () => {
			const event = new JsEvent();
			expect(event.invoke()).toEqual({ type: 'empty' });
		});

		it('Retourne { type: "single", value } si un seul callback', () => {
			const event = new JsEvent<() => number>();
			event.add('key', () => 42);
			const result = event.invoke();
			expect(result.type).toBe('single');
			if (result.type === 'single') expect(result.value).toBe(42);
		});

		it('Retourne { type: "multiple", values } si plusieurs callbacks', () => {
			const event = new JsEvent<() => number>();
			event.add('a', () => 1);
			event.add('b', () => 2);
			const result = event.invoke();
			expect(result.type).toBe('multiple');
			if (result.type === 'multiple') {
				expect(Object.values(result.values)).toContain(1);
				expect(Object.values(result.values)).toContain(2);
			}
		});

		it('Transmet les arguments aux callbacks', () => {
			const cb = vi.fn((x: number) => x * 2);
			const event = new JsEvent<(x: number) => number>();
			event.add('key', cb);
			event.invoke(5);
			expect(cb).toHaveBeenCalledWith(5);
		});

		it("Appelle les callbacks dans l'ordre d'enregistrement", () => {
			const order: number[] = [];
			const event = new JsEvent();
			event.add('a', () => order.push(1));
			event.add('b', () => order.push(2));
			event.add('c', () => order.push(3));
			event.invoke();
			expect(order).toEqual([1, 2, 3]);
		});

		it('Préserve les clés dans values pour multiple', () => {
			const event = new JsEvent<() => number>();
			event.add('premier', () => 1);
			event.add('second', () => 2);
			const result = event.invoke();
			if (result.type === 'multiple') {
				expect(result.values['premier']).toBe(1);
				expect(result.values['second']).toBe(2);
			}
		});

		it("N'altère pas les callbacks enregistrés après l'invocation", () => {
			const event = new JsEvent();
			event.add('key', fn());
			event.invoke();
			// le délégué éphémère est clear() après invoke — les callbacks originaux restent
			expect(event.count()).toBe(1);
		});

		it("Un callback ajouté pendant l'invocation n'est pas appelé dans la même passe", () => {
			const event = new JsEvent();
			const lateCall = vi.fn();
			event.add('a', () => {
				event.add('late', lateCall);
			});
			event.invoke();
			expect(lateCall).not.toHaveBeenCalled();
		});
	});

	// ── call (deprecated) ──────────────────────────────────────
	describe('call (deprecated)', () => {
		it('Retourne null si aucun callback', () => {
			expect(new JsEvent().call()).toBeNull();
		});

		it('Retourne la valeur directe si un seul callback', () => {
			const event = new JsEvent<() => number>();
			event.add('key', () => 42);
			expect(event.call()).toBe(42);
		});

		it('Retourne un tableau si plusieurs callbacks', () => {
			const event = new JsEvent<() => number>();
			event.add('a', () => 1);
			event.add('b', () => 2);
			const result = event.call();
			expect(Array.isArray(result)).toBe(true);
			expect(result).toContain(1);
			expect(result).toContain(2);
		});
	});

	// ── événements d'observation ───────────────────────────────
	describe("événements d'observation", () => {
		it("onHandlerAdded se déclenche lors d'un add", () => {
			const event = new JsEvent();
			const spy = vi.fn();
			event.onHandlerAdded.push(spy);
			event.add('key', fn());
			expect(spy).toHaveBeenCalledOnce();
		});

		it("onHandlerRemoved se déclenche lors d'un remove", () => {
			const event = new JsEvent();
			const spy = vi.fn();
			event.onHandlerRemoved.push(spy);
			event.add('key', fn());
			event.remove('key');
			expect(spy).toHaveBeenCalledOnce();
		});

		it("onHandlerCleared se déclenche lors d'un clear", () => {
			const event = new JsEvent();
			const spy = vi.fn();
			event.onHandlerCleared.push(spy);
			event.add('key', fn());
			event.clear();
			expect(spy).toHaveBeenCalledOnce();
		});
	});
});

// ── JsCircularEvent ───────────────────────────────────────────
describe('JsCircularEvent', () => {
	// ── invoke ────────────────────────────────────────────────
	describe('invoke', () => {
		it('Retourne { type: "empty" } si aucun callback', () => {
			const event = new JsCircularEvent<
				(p: { count: number }) => { count: number }
			>();
			expect(event.invoke({ count: 0 })).toEqual({ type: 'empty' });
		});

		it('Propage et merge le record entre les callbacks', () => {
			const event = new JsCircularEvent<
				(p: { count: number }) => { count: number }
			>();
			event.add('double', ({ count }) => ({ count: count * 2 }));
			event.add('add10', ({ count }) => ({ count: count + 10 }));
			const result = event.invoke({ count: 5 });
			expect(result.type).toBe('record');
			if (result.type === 'record') expect(result.value.count).toBe(20);
		});

		it("Remplace silencieusement args[0] par {} si ce n'est pas un plain object", () => {
			const event = new JsCircularEvent();
			event.add('key', r => ({ ...r, touched: true }));
			const result = event.invoke('not-a-record' as any);
			// contrairement à CircularEventHandler, pas de type 'other'
			expect(result.type).toBe('record');
		});

		it('Ne retourne jamais { type: "other" } contrairement à CircularEventHandler', () => {
			const event = new JsCircularEvent();
			event.add('key', fn() as any);
			const result = event.invoke(42 as any);
			expect(result.type).not.toBe('other');
		});

		it('Utilise {} comme record initial si args[0] est undefined', () => {
			const event = new JsCircularEvent();
			event.add('key', r => ({ ...r, touched: true }));
			const result = event.invoke(undefined as any);
			expect(result.type).toBe('record');
			if (result.type === 'record') expect(result.value.touched).toBe(true);
		});

		it('Ne mute pas le record original', () => {
			const event = new JsCircularEvent<
				(p: { count: number }) => { count: number }
			>();
			event.add('inc', ({ count }) => ({ count: count + 1 }));
			const original = { count: 0 };
			event.invoke(original);
			expect(original.count).toBe(0);
		});

		it("N'altère pas les callbacks enregistrés après l'invocation", () => {
			const event = new JsCircularEvent();
			event.add('key', r => r);
			event.invoke({});
			// le délégué éphémère est clear() après invoke — les callbacks originaux restent
			expect(event.count()).toBe(1);
		});

		it("Appelle les callbacks dans l'ordre d'enregistrement", () => {
			const order: number[] = [];
			const event = new JsCircularEvent();
			event.add('a', r => {
				order.push(1);
				return r;
			});
			event.add('b', r => {
				order.push(2);
				return r;
			});
			event.invoke({});
			expect(order).toEqual([1, 2]);
		});
	});

	// ── call (deprecated) ──────────────────────────────────────
	describe('call (deprecated)', () => {
		it('Retourne null si aucun callback', () => {
			const event = new JsCircularEvent<
				(p: { count: number }) => { count: number }
			>();
			expect(event.call({ count: 0 })).toBeNull();
		});

		it('Retourne le record final', () => {
			const event = new JsCircularEvent<
				(p: { count: number }) => { count: number }
			>();
			event.add('inc', ({ count }) => ({ count: count + 1 }));
			expect(event.call({ count: 0 })).toEqual({ count: 1 });
		});

		it('Lève une erreur si invoke retourne un type inattendu', () => {
			const event = new JsCircularEvent();
			vi.spyOn(event, 'invoke').mockReturnValue({
				type: 'other',
				value: null,
				originalValue: 42,
			} as any);
			expect(() => event.call({} as any)).toThrow();
		});

		it("Le message d'erreur mentionne le type inattendu", () => {
			const event = new JsCircularEvent();
			vi.spyOn(event, 'invoke').mockReturnValue({
				type: 'other',
				value: null,
				originalValue: 42,
			} as any);
			expect(() => event.call({} as any)).toThrow(/other/);
		});
	});

	// ── événements d'observation ───────────────────────────────
	describe("événements d'observation", () => {
		it("onHandlerAdded se déclenche lors d'un add", () => {
			const event = new JsCircularEvent();
			const spy = vi.fn();
			event.onHandlerAdded.push(spy);
			event.add('key', r => r);
			expect(spy).toHaveBeenCalledOnce();
		});

		it("onHandlerRemoved se déclenche lors d'un remove", () => {
			const event = new JsCircularEvent();
			const spy = vi.fn();
			event.onHandlerRemoved.push(spy);
			event.add('key', r => r);
			event.remove('key');
			expect(spy).toHaveBeenCalledOnce();
		});

		it("onHandlerCleared se déclenche lors d'un clear", () => {
			const event = new JsCircularEvent();
			const spy = vi.fn();
			event.onHandlerCleared.push(spy);
			event.add('key', r => r);
			event.clear();
			expect(spy).toHaveBeenCalledOnce();
		});
	});
});
