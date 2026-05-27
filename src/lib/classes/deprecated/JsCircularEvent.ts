import { Func, isPlainObject, MayBe, Nullable, zip } from '@rotomeca/utils';
import { AEventHandler } from '../../abstract/AEventHandler';
import {
	CircularEventCallResult,
	EventCallResult,
	HandlerAddedCallback,
	HandlerClearedCallback,
	HandlerRemovedCallback,
} from '../../utils/types';
import { IEventHandler } from '../../interfaces/IEventHandler';
import { CircularEventDelegate } from '../CircularEventHandler';
import { EventHandler } from '../EventHandler';

/**
 * Gestionnaire d'événements circulaire — version historique de {@link CircularEventDelegate}.
 *
 * `JsCircularEvent` propage un record muté de callback en callback, en déléguant
 * chaque invocation à un {@link CircularEventDelegate} éphémère reconstruit à chaque appel.
 * Cette reconstruction systématique est la principale raison de la dépréciation :
 * elle est inutilement coûteuse et ne présente aucun avantage par rapport à
 * l'utilisation directe de {@link CircularEventDelegate}.
 *
 * Si `args[0]` n'est pas un plain object, il est silencieusement remplacé par `{}`
 * avant d'être transmis à la chaîne — contrairement à {@link CircularEventDelegate}
 * qui émet un avertissement et encapsule la valeur dans `{ default: valeur }`.
 *
 * @typeParam TCallback - Type du callback. Doit étendre {@link Func}.
 *                        Par défaut `Func<[Record<string, unknown>], Record<string, unknown>>`.
 *
 * @example
 * ```ts
 * // ❌ À éviter — classe dépréciée
 * const event = new JsCircularEvent<(p: { count: number }) => { count: number }>();
 * event.add('increment', ({ count }) => ({ count: count + 1 }));
 * event.invoke({ count: 0 });
 *
 * // ✅ Préférer
 * const event = new CircularEventDelegate<{ count: number }>();
 * event.add('increment', ({ count }) => ({ count: count + 1 }));
 * event.invoke({ count: 0 });
 * ```
 *
 * @see {@link CircularEventDelegate} — remplaçant direct
 * @see {@link CircularEventHandler} — remplaçant avec contrôle fin des génériques
 *
 * @deprecated Utilisez {@link CircularEventDelegate} ou {@link CircularEventHandler} à la place.
 */
export class JsCircularEvent<
	TCallback extends Func = Func<
		[Record<string, unknown>],
		Record<string, unknown>
	>,
> extends AEventHandler<
	Parameters<TCallback>,
	TCallback,
	CircularEventCallResult<Parameters<TCallback>[0]>
> {
	/**
	 * Déclenche la chaîne de callbacks en propageant un record muté de l'un à l'autre.
	 *
	 * Construit à chaque appel un {@link CircularEventDelegate} éphémère, y transfère
	 * tous les callbacks enregistrés dans leur ordre d'enregistrement, déclenche
	 * la propagation, puis efface le délégué temporaire.
	 *
	 * Si `args[0]` n'est pas un plain object, il est silencieusement remplacé par `{}`
	 * — la chaîne s'exécute alors sur un record vide.
	 *
	 * @param args - Arguments transmis à la chaîne. Seul `args[0]` est utilisé comme
	 *               record initial ; les arguments suivants sont ignorés.
	 * @returns Un {@link CircularEventCallResult} décrivant le résultat :
	 * - `{ type: 'empty' }` si aucun callback n'est enregistré.
	 * - `{ type: 'record', value }` si la chaîne s'est exécutée normalement.
	 *
	 * @example
	 * ```ts
	 * const event = new JsCircularEvent<(p: { value: number }) => { value: number }>();
	 * event.add('double', ({ value }) => ({ value: value * 2 }));
	 *
	 * const result = event.invoke({ value: 5 });
	 *
	 * if (result.type === 'record') {
	 *   console.log(result.value); // { value: 10 }
	 * }
	 * ```
	 *
	 * @see {@link CircularEventDelegate.invoke} pour l'implémentation sans reconstruction
	 */
	invoke(...args: any[]): CircularEventCallResult<Parameters<TCallback>[0]> {
		let param = args?.[0] ?? {};

		if (!isPlainObject(param)) param = {};

		const event = new CircularEventDelegate();
		for (const [key, callback] of zip(this.keys, this.getInvocationList())) {
			event.add(key, callback);
		}

		const result = event.invoke(param);
		event.clear();

		return result;
	}

	/**
	 * Déclenche la chaîne de callbacks et retourne le record final.
	 *
	 * @param param - Le record initial transmis au premier callback.
	 *                Si ce n'est pas un plain object, la chaîne s'exécute sur `{}`.
	 * @param args - Arguments supplémentaires — ignorés, conservés pour la
	 *               compatibilité avec l'ancienne signature.
	 * @returns Le record final après passage dans tous les callbacks,
	 *          ou `null` si aucun callback n'est enregistré.
	 *
	 * @throws {Error} Si {@link invoke} retourne un résultat de type `'other'` —
	 *                 état normalement inatteignable puisque {@link invoke} garantit
	 *                 que le paramètre transmis est toujours un plain object.
	 *
	 * @see {@link invoke} — variante retournant un {@link CircularEventCallResult} discriminé
	 *
	 * @deprecated Utilisez {@link CircularEventDelegate} ou {@link CircularEventHandler}
	 * et leur méthode {@link CircularEventDelegate.invoke | invoke} à la place.
	 */
	call(
		param: Parameters<TCallback>[0],
		...args: any[]
	): Nullable<Parameters<TCallback>[0]> {
		const result = this.invoke(param, ...args);

		switch (result.type) {
			case 'empty':
				return null;

			case 'record':
				return result.value;

			default:
				throw new Error(
					`État inattendu : invoke() a retourné le type '${(result as any).type}'. ` +
						`Cela ne devrait pas se produire car invoke() garantit un plain object en entrée.`,
				);
		}
	}

	/**
	 * Initialise l'instance de {@link onHandlerAdded}.
	 * @returns Une nouvelle instance de {@link EventHandler}.
	 * @protected
	 */
	protected _p_initOnHandlerAdded(): IEventHandler<
		[key: string, callbackAdded: TCallback],
		HandlerAddedCallback<Parameters<TCallback>, TCallback>,
		EventCallResult<HandlerAddedCallback<Parameters<TCallback>, TCallback>>
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
		HandlerRemovedCallback<Parameters<TCallback>, TCallback>,
		EventCallResult<HandlerRemovedCallback<Parameters<TCallback>, TCallback>>
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
		HandlerClearedCallback<Parameters<TCallback>, TCallback>,
		EventCallResult<HandlerClearedCallback<Parameters<TCallback>, TCallback>>
	> {
		return new EventHandler();
	}
}
