import { Func, MayBe, Nullable, zip } from '@rotomeca/utils';
import { AEventHandler } from '../../abstract/AEventHandler';
import { IEventHandler } from '../../interfaces/IEventHandler';
import {
	EventCallResult,
	HandlerAddedCallback,
	HandlerRemovedCallback,
	HandlerClearedCallback,
} from '../../utils/types';
import { EventDelegate, EventHandler } from '../EventHandler';

/**
 * Gestionnaire d'événements générique — version historique de {@link EventDelegate}.
 *
 * `JsEvent` accepte n'importe quelle signature de callback via `any[]` et délègue
 * son {@link invoke} à un {@link EventDelegate} éphémère reconstruit à chaque appel.
 * Cette reconstruction systématique est la principale raison de la dépréciation :
 * elle est inutilement coûteuse et ne présente aucun avantage par rapport à
 * l'utilisation directe de {@link EventDelegate} ou {@link EventHandler}.
 *
 * @typeParam TCallback - Type du callback. Doit étendre {@link Func}.
 *                        Par défaut `Func`.
 *
 * @example
 * ```ts
 * // ❌ À éviter — classe dépréciée
 * const event = new JsEvent<(msg: string) => void>();
 * event.add('handler', (msg) => console.log(msg));
 * event.invoke('bonjour');
 *
 * // ✅ Préférer
 * const event = new EventDelegate<(msg: string) => void>();
 * event.add('handler', (msg) => console.log(msg));
 * event.invoke('bonjour');
 * ```
 *
 * @see {@link EventDelegate} — remplaçant direct, un seul générique
 * @see {@link EventHandler} — remplaçant avec contrôle fin des génériques
 *
 * @deprecated Utilisez {@link EventDelegate} ou {@link EventHandler} à la place.
 */
export class JsEvent<TCallback extends Func = Func> extends AEventHandler<
	any[],
	TCallback
> {
	/**
	 * Crée une instance de {@link JsEvent}.
	 *
	 * @deprecated Instanciez {@link EventDelegate} ou {@link EventHandler} à la place.
	 */
	constructor() {
		super();
	}

	/**
	 * Déclenche tous les callbacks enregistrés avec les arguments fournis.
	 *
	 * Le résultat dépend du nombre de callbacks enregistrés :
	 * - `{ type: 'empty' }` si aucun callback n'est enregistré.
	 * - `{ type: 'single', value }` si un seul callback est enregistré.
	 * - `{ type: 'multiple', values }` si plusieurs callbacks sont enregistrés.
	 *
	 * @param args - Arguments transmis à chaque callback lors de l'appel.
	 *               Accepte n'importe quelle signature (`any[]`).
	 * @returns Un {@link EventCallResult} décrivant le résultat de l'appel.
	 *
	 * @example
	 * ```ts
	 * const event = new JsEvent<(n: number) => number>();
	 * event.add('double', (n) => n * 2);
	 *
	 * const result = event.invoke(5);
	 *
	 * if (result.type === 'single') {
	 *   console.log(result.value); // 10
	 * }
	 * ```
	 *
	 * @see {@link EventCallResult}
	 * @see {@link EventDelegate.invoke} pour l'implémentation sans reconstruction
	 */
	invoke(...args: any[]): EventCallResult<TCallback> {
		let event = new EventDelegate();
		for (const [key, callback] of zip(this.keys, this.getInvocationList())) {
			event.add(key, callback);
		}

		const result = event.invoke(...args);
		event.clear();

		return result;
	}

	/**
	 * Déclenche tous les callbacks enregistrés et retourne leur résultat
	 * sous une forme simplifiée.
	 *
	 * @typeParam TResult - Type de la valeur retournée par les callbacks.
	 *                      Par défaut `ReturnType<TCallback>`.
	 *
	 * @param args - Arguments transmis à chaque callback lors de l'appel.
	 * @returns `null` si aucun callback, la valeur directe si un seul,
	 *          un tableau de valeurs si plusieurs.
	 *
	 * @example
	 * ```ts
	 * const event = new JsEvent<() => string>();
	 * event.add('a', () => 'bonjour');
	 * event.add('b', () => 'monde');
	 *
	 * const result = event.call(); // ['bonjour', 'monde']
	 * ```
	 *
	 * @see {@link invoke} — variante typée retournant un {@link EventCallResult} discriminé
	 *
	 * @deprecated Utilisez {@link EventDelegate} ou {@link EventHandler} et leur méthode
	 * {@link EventHandler.invoke | invoke} qui retourne un {@link EventCallResult} discriminé,
	 * plus sûr à utiliser en TypeScript.
	 */
	call<TResult = ReturnType<TCallback>>(
		...args: any[]
	): Nullable<TResult | TResult[]> {
		const result = this.invoke(...args);

		switch (result.type) {
			case 'empty':
				return null;

			case 'single':
				return result.value;

			default:
				return [...Object.values(result.values)];
		}
	}

	/**
	 * Initialise l'instance de {@link onHandlerAdded}.
	 * @returns Une nouvelle instance de {@link EventHandler}.
	 * @protected
	 */
	protected _p_initOnHandlerAdded(): IEventHandler<
		[key: string, callbackAdded: TCallback],
		HandlerAddedCallback<any[], TCallback>,
		EventCallResult<HandlerAddedCallback<any[], TCallback>>
	> {
		return new EventHandler();
	}

	/**
	 * Initialise l'instance de {@link onHandlerRemoved}.
	 * @returns Une nouvelle instance de {@link EventHandler}.
	 * @protected
	 */
	protected _p_initOnHandlerRemoved(): IEventHandler<
		[key: string, callbackRemoved: MayBe<TCallback>],
		HandlerRemovedCallback<any[], TCallback>,
		EventCallResult<HandlerRemovedCallback<any[], TCallback>>
	> {
		return new EventHandler();
	}

	/**
	 * Initialise l'instance de {@link onHandlerCleared}.
	 * @returns Une nouvelle instance de {@link EventHandler}.
	 * @protected
	 */
	protected _p_initOnHandlerCleared(): IEventHandler<
		[callbacksCleared: TCallback[]],
		HandlerClearedCallback<any[], TCallback>,
		EventCallResult<HandlerClearedCallback<any[], TCallback>>
	> {
		return new EventHandler();
	}
}
