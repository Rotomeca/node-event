import { first, Func, isDefined, Nullable, pipe } from '@rotomeca/utils';
import {
	EventCallResult,
	HandlerAddedCallback,
	HandlerRemovedCallback,
	HandlerClearedCallback,
} from '../utils';
import { AEventHandler } from '../abstract';
import { IEventHandler } from '../interfaces';

/**
 * Implémentation concrète de {@link AEventHandler}.
 *
 * Gestionnaire d'événements typé inspiré du pattern
 * [`event`](https://learn.microsoft.com/fr-fr/dotnet/csharp/programming-guide/events/)
 * de C#. Chaque callback est appelé indépendamment — le résultat de l'un
 * n'influence pas l'appel du suivant.
 *
 * Pour un comportement circulaire où chaque callback reçoit le résultat
 * du précédent, utiliser {@link CircularEventHandler} à la place.
 *
 * @typeParam TArgs - Tuple représentant les types des arguments transmis
 *                    aux callbacks lors de l'appel. Par défaut `any[]`.
 * @typeParam T - Type des callbacks attachés à l'événement,
 *               doit étendre `Func<TArgs>`. Par défaut `Func<TArgs>`.
 *
 * @example
 * ```ts
 * const onClick = new EventHandler<[MouseEvent]>();
 *
 * onClick.add('logger', (e) => console.log(e.clientX));
 * onClick.add('tracker', (e) => analytics.track(e));
 *
 * onClick.invoke(new MouseEvent('click'));
 * ```
 *
 * @see {@link https://learn.microsoft.com/fr-fr/dotnet/api/system.eventhandler-1 | EventHandler\<TEventArgs\> — C#}
 */
export class EventHandler<
	TArgs extends any[] = any[],
	T extends Func<TArgs> = Func<TArgs>,
> extends AEventHandler<TArgs, T> {
	constructor() {
		super();
	}

	/**
	 * Déclenche tous les callbacks enregistrés avec les arguments fournis.
	 *
	 * Chaque callback est appelé avec ses arguments par défaut suivis des
	 * arguments passés à `invoke`. Les callbacks sont appelés dans leur
	 * ordre d'enregistrement, indépendamment les uns des autres.
	 *
	 * Le résultat dépend du nombre de callbacks enregistrés :
	 * - `{ type: 'empty' }` si aucun callback n'est enregistré.
	 * - `{ type: 'single', value }` si un seul callback est enregistré.
	 * - `{ type: 'multiple', values }` si plusieurs callbacks sont enregistrés.
	 *
	 * @param params - Arguments transmis à chaque callback lors de l'appel.
	 * @returns Un {@link EventCallResult} décrivant le résultat de l'appel.
	 *
	 * @example
	 * ```ts
	 * const result = event.invoke('bonjour');
	 *
	 * switch (result.type) {
	 *   case 'empty':    break;
	 *   case 'single':   console.log(result.value); break;
	 *   case 'multiple': console.log(result.values); break;
	 * }
	 * ```
	 *
	 * @see {@link https://learn.microsoft.com/fr-fr/dotnet/api/system.delegate.invoke | Delegate.Invoke — C#}
	 */
	invoke(...params: TArgs): EventCallResult<T> {
		let results: Record<string, ReturnType<T>> = {};
		const keys = this.keys;

		if (keys.length !== 0) {
			for (let index = 0, len = keys.length; index < len; ++index) {
				const key = keys[index];
				const data = this._p_get(key);

				if (isDefined(data)) {
					const { args, callback } = data;

					if (callback)
						results[key] = callback(...([...args, ...params] as TArgs));
				}
			}
		}

		switch (Object.keys(results).length) {
			case 0:
				return { type: 'empty' };
			case 1:
				return {
					type: 'single',
					value: results[pipe(results, Object.keys, first)!],
				};
			default:
				return { type: 'multiple', values: results };
		}
	}

	/**
	 * Déclenche tous les callbacks enregistrés et retourne leur résultat
	 * sous une forme simplifiée.
	 *
	 * @param args - Arguments transmis à chaque callback lors de l'appel.
	 * @returns `null` si aucun callback, la valeur directe si un seul,
	 *          un tableau de valeurs si plusieurs.
	 *
	 * @deprecated Utilisez {@link invoke} à la place. `invoke` retourne un
	 * {@link EventCallResult} discriminé qui permet de distinguer sans ambiguïté
	 * les trois cas, même si `ReturnType<T>` est lui-même un objet ou un tableau.
	 */
	call(...args: TArgs): Nullable<ReturnType<T> | ReturnType<T>[]> {
		const data = this.invoke(...args);

		switch (data.type) {
			case 'empty':
				return null;

			case 'single':
				return data.value;

			case 'multiple':
				return [...Object.values(data.values)];

			default:
				throw new Error(
					`Le type ${(data as any).type ?? 'null'} n'est pas pris en charge !`,
				);
		}
	}

	/**
	 * Initialise l'instance de {@link onHandlerAdded}.
	 * @returns Une nouvelle instance de {@link EventHandler}.
	 * @protected
	 */
	protected _p_initOnHandlerAdded(): IEventHandler<
		Parameters<HandlerAddedCallback<TArgs, T>>,
		HandlerAddedCallback<TArgs, T>
	> {
		return new EventHandler();
	}

	/**
	 * Initialise l'instance de {@link onHandlerRemoved}.
	 * @returns Une nouvelle instance de {@link EventHandler}.
	 * @protected
	 */
	protected _p_initOnHandlerRemoved(): IEventHandler<
		Parameters<HandlerRemovedCallback<TArgs, T>>,
		HandlerRemovedCallback<TArgs, T>
	> {
		return new EventHandler();
	}

	/**
	 * Initialise l'instance de {@link onHandlerCleared}.
	 * @returns Une nouvelle instance de {@link EventHandler}.
	 * @protected
	 */
	protected _p_initOnHandlerCleared(): IEventHandler<
		Parameters<HandlerClearedCallback<TArgs, T>>,
		HandlerClearedCallback<TArgs, T>
	> {
		return new EventHandler();
	}
}

/**
 * Raccourci ergonomique vers {@link EventHandler} avec un seul générique.
 *
 * Permet d'instancier un gestionnaire d'événement en ne spécifiant que
 * le type du callback, sans avoir à décomposer manuellement `TArgs` :
 *
 * ```ts
 * // Avec EventDelegate — un seul générique
 * const onClick = new EventDelegate<(e: MouseEvent) => void>();
 *
 * // Équivalent avec EventHandler — verbeux
 * const onClick = new EventHandler<[MouseEvent], (e: MouseEvent) => void>();
 * ```
 *
 * @typeParam T - Type du callback. `Parameters<T>` et `ReturnType<T>` sont
 *               automatiquement extraits pour alimenter {@link EventHandler}.
 *               Par défaut `Func`.
 *
 * @example
 * ```ts
 * type OnFrameCreatedCallback = (frame: FrameData) => void;
 *
 * const onFrameCreated = new EventDelegate<OnFrameCreatedCallback>();
 * onFrameCreated.add('handler', (frame) => console.log(frame));
 * onFrameCreated.invoke(frameData);
 * ```
 *
 * @see {@link EventHandler} pour l'API complète avec contrôle fin des génériques
 * @see {@link JsCircularEvent} pour la variante circulaire
 */
export class EventDelegate<T extends Func = Func> extends EventHandler<
	Parameters<T>,
	T
> {}

/**
 * Alias de {@link EventDelegate} conservé pour la compatibilité ascendante.
 *
 * @deprecated Utilisez {@link EventDelegate} ou {@link EventHandler} à la place.
 */
export const JsEvent = EventDelegate;
