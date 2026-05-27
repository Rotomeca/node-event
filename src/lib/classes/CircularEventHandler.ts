import {
	deepMerge,
	Func,
	isDefined,
	isPlainObject,
	MayBe,
} from '@rotomeca/utils';
import { AEventHandler } from '../abstract/AEventHandler';
import {
	CircularEventCallResult,
	HandlerAddedCallback,
	HandlerClearedCallback,
	HandlerRemovedCallback,
} from '../utils/types';
import { IEventHandler } from '../interfaces/IEventHandler';
import { EventHandler } from './EventHandler';

/**
 * Gestionnaire d'événements circulaire — chaque callback reçoit et transforme
 * le résultat du précédent.
 *
 * Contrairement à {@link EventHandler} où les callbacks sont indépendants,
 * `CircularEventHandler` propage un record muté de callback en callback.
 * Chaque résultat est mergé dans le record courant avant d'être transmis
 * au callback suivant.
 *
 * Inspiré du pattern
 * [`Middleware`](https://learn.microsoft.com/fr-fr/aspnet/core/fundamentals/middleware)
 * de C# / ASP.NET Core, où chaque maillon de la chaîne peut enrichir
 * la requête avant de la passer au suivant.
 *
 * @typeParam TRecord - Type du record transmis et muté entre les callbacks.
 *                      Doit étendre `Record<string, unknown>`. Par défaut
 *                      `Record<string, unknown>`.
 * @typeParam T - Type des callbacks, doit retourner `Partial<TRecord>`.
 *               Par défaut `Func<[TRecord], Partial<TRecord>>`.
 *
 * @example
 * ```ts
 * const pipeline = new CircularEventHandler<{ value: number }>();
 *
 * pipeline.add('double',  ({ value }) => ({ value: value * 2 }));
 * pipeline.add('addTen',  ({ value }) => ({ value: value + 10 }));
 *
 * const result = pipeline.invoke({ value: 5 });
 * // result.type  → 'record'
 * // result.value → { value: 20 }  (5 * 2 = 10, puis 10 + 10 = 20)
 * ```
 *
 * @see {@link EventHandler} pour un gestionnaire sans propagation de résultat
 * @see {@link https://learn.microsoft.com/fr-fr/aspnet/core/fundamentals/middleware | Middleware — ASP.NET Core}
 */
export class CircularEventHandler<
	TRecord extends Record<string, unknown> = Record<string, unknown>,
	T extends Func<[TRecord], Partial<TRecord>> = Func<
		[TRecord],
		Partial<TRecord>
	>,
> extends AEventHandler<[TRecord], T, CircularEventCallResult<TRecord>> {
	#_logger: (...args: any[]) => void;

	/**
	 *
	 * @param warnLogger Logger si un problème survient dans le {@link invoke}.
	 */
	constructor(
		warnLogger: (...args: any[]) => void = (...args: any[]) => {
			console.warn(...args);
		},
	) {
		super();
		this.#_logger = warnLogger || console.warn;
	}

	/**
	 * Déclenche la chaîne de callbacks en propageant un record muté de l'un
	 * à l'autre.
	 *
	 * Pour chaque callback enregistré, dans l'ordre d'enregistrement :
	 * 1. Les arguments par défaut du callback (s'ils sont un plain object)
	 *    sont mergés dans le record courant.
	 * 2. Le callback est appelé avec le record courant.
	 * 3. Si le résultat est un plain object, il est mergé dans le record courant
	 *    avant le prochain callback.
	 *
	 * Si `args_0` n'est pas un plain object, un avertissement est émis via
	 * `logger`, la valeur est wrappée dans `{ default: args_0 }` et la chaîne
	 * est exécutée normalement. Le résultat est alors de type `'other'`.
	 *
	 * @param args_0 - Le record initial transmis au premier callback.
	 * @returns Un {@link CircularEventCallResult} décrivant le résultat :
	 * - `{ type: 'empty' }` si aucun callback n'est enregistré.
	 * - `{ type: 'record', value }` si la chaîne s'est exécutée normalement.
	 * - `{ type: 'other', value, originalValue }` si `args_0` n'était pas
	 *   un plain object.
	 *
	 * @example
	 * ```ts
	 * const result = pipeline.invoke({ count: 0 });
	 *
	 * if (result.type === 'record') {
	 *   console.log(result.value.count);
	 * }
	 * ```
	 */
	invoke(args_0: TRecord): CircularEventCallResult<TRecord> {
		if (!this.haveEvents()) return { type: 'empty' };

		if (!isPlainObject(args_0)) {
			this.#_logger(
				'Attention !',
				args_0,
				"n'est pas un objet ! Cela peut provoquer des effets inattendu !",
			);
			const result = this.invoke({ default: args_0 } as unknown as TRecord);

			return {
				type: 'other',
				value: result.type === 'empty' ? null : result.value,
				originalValue: args_0,
			};
		}

		let results: TRecord = { ...args_0 };
		const keys = this.keys;

		for (let index = 0, len = keys.length; index < len; ++index) {
			const key = keys[index];
			const data = this._p_get(key);

			if (isDefined(data)) {
				const { args, callback } = data;

				if (callback) {
					const additionalArgs: TRecord | {} =
						args && args.length && isPlainObject(args[0]) ? args[0] : {};
					results = deepMerge(results, additionalArgs);
					const result = callback(results);

					if (isPlainObject(result)) results = deepMerge(results, result);
				}
			}
		}

		return { type: 'record', value: results };
	}

	/**
	 * Déclenche la chaîne de callbacks et retourne le record final.
	 *
	 * Conserve la compatibilité avec l'ancienne API `JsCircularEvent.call()`.
	 * Préférer {@link invoke} qui retourne un {@link CircularEventCallResult}
	 * discriminé, plus sûr à utiliser en TypeScript.
	 *
	 * @param param - Le record initial transmis au premier callback.
	 * @returns Le record final après passage dans tous les callbacks,
	 *          ou `null` si aucun callback n'est enregistré.
	 *
	 * @deprecated Utilisez {@link invoke} à la place.
	 */
	call(param: TRecord): TRecord | null {
		const result = this.invoke(param);

		switch (result.type) {
			case 'empty':
				return null;
			case 'record':
				return result.value;
			case 'other':
				return result.value as TRecord;
		}
	}

	/**
	 * Initialise l'instance de {@link onHandlerAdded}.
	 * @returns Une nouvelle instance de {@link EventHandler}.
	 * @protected
	 */
	protected _p_initOnHandlerAdded(): IEventHandler<
		[key: string, callbackAdded: T],
		HandlerAddedCallback<[TRecord], T>
	> {
		return new EventHandler();
	}

	/**
	 * Initialise l'instance de {@link onHandlerRemoved}.
	 * @returns Une nouvelle instance de {@link EventHandler}.
	 * @protected
	 */
	protected _p_initOnHandlerRemoved(): IEventHandler<
		[key: string, callbackRemoved: MayBe<T>],
		HandlerRemovedCallback<[TRecord], T>
	> {
		return new EventHandler();
	}

	/**
	 * Initialise l'instance de {@link onHandlerCleared}.
	 * @returns Une nouvelle instance de {@link EventHandler}.
	 * @protected
	 */
	protected _p_initOnHandlerCleared(): IEventHandler<
		[callbacksCleared: T[]],
		HandlerClearedCallback<[TRecord], T>
	> {
		return new EventHandler();
	}
}

/**
 * Raccourci ergonomique vers {@link CircularEventHandler} conservant
 * la même signature qu'à l'origine.
 *
 * Permet d'instancier un gestionnaire d'événement circulaire en ne
 * spécifiant que le type du record propagé entre les callbacks :
 *
 * ```ts
 * // Avec CircularEventDelegate
 * const pipeline = new CircularEventDelegate<{ count: number }>();
 *
 * // Équivalent avec CircularEventHandler
 * const pipeline = new CircularEventHandler<{ count: number }, (param: { count: number }) => Partial<{ count: number }>>();
 * ```
 *
 * @typeParam TRecord - Type du record propagé entre les callbacks.
 *                      Doit étendre `Record<string, unknown>`.
 *                      Par défaut `Record<string, unknown>`.
 *
 * @example
 * ```ts
 * const pipeline = new CircularEventDelegate<{ count: number; label: string }>();
 *
 * pipeline.add('increment', (record) => ({ count: record.count + 1 }));
 * pipeline.add('label',     (record) => ({ label: `count=${record.count}` }));
 *
 * const result = pipeline.invoke({ count: 0, label: '' });
 * // result → { type: 'record', value: { count: 1, label: 'count=1' } }
 * ```
 *
 * @see {@link CircularEventHandler} pour l'API complète
 * @see {@link EventDelegate} pour la variante standard
 */
export class CircularEventDelegate<
	TRecord extends Record<string, unknown> = Record<string, unknown>,
> extends CircularEventHandler<TRecord> {}

/**
 * Alias de {@link CircularEventDelegate} conservé pour la compatibilité ascendante.
 *
 * @deprecated Utilisez {@link CircularEventDelegate} ou {@link CircularEventHandler} à la place.
 */
export const JsCircularEvent = CircularEventDelegate;
