import {
	Func,
	Int,
	isDefined,
	MayBe,
	pipe,
	Random,
	toUint,
	uint,
} from '@rotomeca/utils';
import { IEventHandler } from '../interfaces/IEvent';
import {
	EventCallResult,
	HandlerAddedCallback,
	HandlerClearedCallback,
	HandlerRemovedCallback,
} from '../../types';
import { IEventData } from '../interfaces/IEventData';
import { EventData } from '../EventData';

/**
 * Implémentation abstraite de {@link IEventHandler}.
 *
 * Fournit toute la logique commune aux gestionnaires d'événements :
 * gestion de la liste des callbacks, génération des clés, déclenchement
 * des événements d'observation (`onHandlerAdded`, `onHandlerRemoved`,
 * `onHandlerCleared`).
 *
 * Les classes concrètes n'ont qu'à implémenter {@link invoke} et les trois
 * méthodes d'initialisation des événements d'observation.
 *
 * @typeParam TArgs - Tuple représentant les types des arguments transmis
 *                    aux callbacks lors de l'appel. Par défaut `any[]`.
 * @typeParam T - Type des callbacks attachés à l'événement,
 *               doit étendre `Func<TArgs>`. Par défaut `Func<TArgs>`.
 *
 * @see {@link IEventHandler}
 * @abstract
 */
export abstract class AEventHandler<
	TArgs extends any[] = any[],
	T extends Func<TArgs> = Func<TArgs>,
	TResult = EventCallResult<T>,
> implements IEventHandler<TArgs, T, TResult> {
	/** Dictionnaire interne des callbacks indexés par clé. */
	#_callbacks = new Map<string, IEventData<TArgs, T>>();

	/**
	 * Instance lazy de l'événement d'observation des ajouts.
	 * Initialisée uniquement lors du premier accès à {@link onHandlerAdded}.
	 */
	#_handlerAdded: MayBe<
		IEventHandler<
			[key: string, callbackAdded: T],
			HandlerAddedCallback<TArgs, T>
		>
	>;

	/**
	 * Instance lazy de l'événement d'observation des suppressions unitaires.
	 * Initialisée uniquement lors du premier accès à {@link onHandlerRemoved}.
	 */
	#_handlerRemoved: MayBe<
		IEventHandler<
			Parameters<HandlerRemovedCallback<TArgs, T>>,
			HandlerRemovedCallback<TArgs, T>
		>
	>;

	/**
	 * Instance lazy de l'événement d'observation des effacements globaux.
	 * Initialisée uniquement lors du premier accès à {@link onHandlerCleared}.
	 */
	#_handlerCleared: MayBe<
		IEventHandler<
			Parameters<HandlerClearedCallback<TArgs, T>>,
			HandlerClearedCallback<TArgs, T>
		>
	>;

	/**
	 * Retourne la liste des clés des callbacks actuellement enregistrés.
	 *
	 * @example
	 * ```ts
	 * const keys = event.keys; // ['handler1', 'handler2']
	 * ```
	 */
	get keys(): string[] {
		return [...this.#_callbacks.keys()];
	}

	/**
	 * Événement déclenché chaque fois qu'un handler est ajouté
	 * via {@link add} ou {@link push}.
	 *
	 * Initialisé de façon lazy via {@link _p_initOnHandlerAdded} lors du
	 * premier accès — aucun coût si personne ne s'y abonne.
	 *
	 * @example
	 * ```ts
	 * event.onHandlerAdded.push((key, cb) => {
	 *   console.log(`Handler "${key}" ajouté`);
	 * });
	 * ```
	 *
	 * @see {@link HandlerAddedCallback}
	 */
	get onHandlerAdded(): IEventHandler<
		[key: string, callbackAdded: T],
		HandlerAddedCallback<TArgs, T>
	> {
		return (this.#_handlerAdded ??= this._p_initOnHandlerAdded());
	}

	/**
	 * Événement déclenché chaque fois qu'un handler est retiré via {@link remove}.
	 *
	 * Initialisé de façon lazy via {@link _p_initOnHandlerRemoved} lors du
	 * premier accès — aucun coût si personne ne s'y abonne.
	 *
	 * @example
	 * ```ts
	 * event.onHandlerRemoved.push((key, cb) => {
	 *   console.log(`Handler "${key}" retiré`);
	 * });
	 * ```
	 *
	 * @see {@link HandlerRemovedCallback}
	 */
	get onHandlerRemoved(): IEventHandler<
		Parameters<HandlerRemovedCallback<TArgs, T>>,
		HandlerRemovedCallback<TArgs, T>
	> {
		return (this.#_handlerRemoved ??= this._p_initOnHandlerRemoved());
	}

	/**
	 * Événement déclenché une seule fois lorsque tous les handlers sont
	 * supprimés via {@link clear}.
	 *
	 * Initialisé de façon lazy via {@link _p_initOnHandlerCleared} lors du
	 * premier accès — aucun coût si personne ne s'y abonne.
	 *
	 * @example
	 * ```ts
	 * event.onHandlerCleared.push((callbacks) => {
	 *   console.log(`${callbacks.length} handler(s) supprimé(s)`);
	 * });
	 * ```
	 *
	 * @see {@link HandlerClearedCallback}
	 */
	get onHandlerCleared(): IEventHandler<
		Parameters<HandlerClearedCallback<TArgs, T>>,
		HandlerClearedCallback<TArgs, T>
	> {
		return (this.#_handlerCleared ??= this._p_initOnHandlerCleared());
	}

	constructor() {}

	/**
	 * Ajoute un callback en générant automatiquement une clé unique.
	 *
	 * @param event - Le callback à ajouter.
	 * @param args - Arguments par défaut transmis au callback à chaque appel.
	 * @returns La clé générée.
	 */
	push(event: T, ...args: Partial<TArgs>): string{
		const key = this.#_generateKey();
		this.add(key, event, ...args);

		return key;
	}
	/**
	 * Ajoute un callback avec une clé spécifique.
	 *
	 * @param key - Clé identifiant le callback.
	 * @param event - Le callback à ajouter.
	 * @param args - Arguments par défaut transmis au callback à chaque appel.
	 * @returns L'instance courante pour permettre le chaînage.
	 */
	add(key: string, event: T, ...args: Partial<TArgs>): this {
		this.#_callbacks.set(key, new EventData(event, ...(args as unknown as TArgs)));

		if (isDefined(this.#_handlerAdded) && this.onHandlerAdded.haveEvents())
			this.onHandlerAdded.invoke(
				key,
				event,
			);

		return this;
	}

	/**
	 * Vérifie si un callback est enregistré sous la clé donnée.
	 *
	 * @param key - La clé à vérifier.
	 * @returns `true` si un callback existe pour cette clé, `false` sinon.
	 */
	has(key: string): boolean {
		return this.#_callbacks.has(key);
	}

	/**
	 * Supprime le callback associé à la clé donnée et le retourne.
	 *
	 * Déclenche {@link onHandlerRemoved} si des observateurs sont abonnés.
	 *
	 * @param key - La clé du callback à supprimer.
	 * @returns Le callback supprimé, ou `null` si la clé n'existe pas.
	 */
	remove(key: string): MayBe<T> {
		let element = null;

		if (this.has(key)) {
			element = this.#_callbacks.get(key);
			this.#_callbacks.delete(key);

			if (
				isDefined(this.#_handlerRemoved) &&
				this.onHandlerRemoved.haveEvents()
			)
				this.onHandlerRemoved.invoke(key, element?.callback);
		}

		return element?.callback;
	}

	/**
	 * Indique si au moins un callback est enregistré.
	 *
	 * @returns `true` si l'événement a au moins un callback, `false` sinon.
	 */
	haveEvents(): boolean {
		return this.count() > 0;
	}

	/**
	 * Retourne le nombre de callbacks actuellement enregistrés.
	 *
	 * @returns Le nombre de callbacks sous forme de {@link uint}.
	 */
	count(): uint {
		return toUint(this.#_callbacks.size);
	}

	/**
	 * Déclenche tous les callbacks enregistrés avec les arguments fournis.
	 *
	 * @param args - Arguments transmis à chaque callback lors de l'appel.
	 * @returns Un {@link TResult} décrivant le résultat de l'appel.
	 * @abstract
	 */
	abstract invoke(...args: TArgs): TResult;

	/**
	 * Initialise l'instance de {@link onHandlerAdded}.
	 *
	 * Appelée une seule fois lors du premier accès à {@link onHandlerAdded}.
	 * Les classes concrètes retournent leur propre implémentation de
	 * {@link IEventHandler}.
	 *
	 * @returns Une nouvelle instance de gestionnaire d'événement pour les ajouts.
	 * @protected
	 * @abstract
	 */
	protected abstract _p_initOnHandlerAdded(): IEventHandler<
		[key: string, callbackAdded: T],
		HandlerAddedCallback<TArgs, T>
	>;

	/**
	 * Initialise l'instance de {@link onHandlerRemoved}.
	 *
	 * Appelée une seule fois lors du premier accès à {@link onHandlerRemoved}.
	 *
	 * @returns Une nouvelle instance de gestionnaire d'événement pour les suppressions.
	 * @protected
	 * @abstract
	 */
	protected abstract _p_initOnHandlerRemoved(): IEventHandler<
		Parameters<HandlerRemovedCallback<TArgs, T>>,
		HandlerRemovedCallback<TArgs, T>
	>;

	/**
	 * Initialise l'instance de {@link onHandlerCleared}.
	 *
	 * Appelée une seule fois lors du premier accès à {@link onHandlerCleared}.
	 *
	 * @returns Une nouvelle instance de gestionnaire d'événement pour les effacements.
	 * @protected
	 * @abstract
	 */
	protected abstract _p_initOnHandlerCleared(): IEventHandler<
		Parameters<HandlerClearedCallback<TArgs, T>>,
		HandlerClearedCallback<TArgs, T>
	>;

	/**
	 * Retourne les données associées à la clé donnée, ou `null` si la clé
	 * n'existe pas.
	 *
	 * Point d'accès protégé au dictionnaire interne — permet aux classes
	 * concrètes d'accéder aux données d'un callback sans exposer
	 * `#_callbacks` directement.
	 *
	 * @param key - La clé du callback à récupérer.
	 * @returns Les données du callback, ou `null` si la clé est absente.
	 * @protected
	 */
	protected _p_get(key: string): MayBe<IEventData<TArgs, T>> {
		if (this.has(key)) return this.#_callbacks.get(key);

		return null;
	}

	/**
	 * Supprime tous les callbacks enregistrés en une seule opération O(1).
	 *
	 * Capture la liste des callbacks **avant** l'effacement, puis déclenche
	 * {@link onHandlerCleared} **après** — garantissant que la Map est vide
	 * avant la notification, sans risque de double déclenchement si un
	 * observateur appelle {@link add} dans son callback.
	 *
	 * @returns L'instance courante pour permettre le chaînage.
	 */
	clear(): this {
		const hasHandlers =
			isDefined(this.#_handlerCleared) && this.onHandlerCleared.haveEvents();
		let invocationList = hasHandlers ? this.getInvocationList() : null;

		this.#_callbacks.clear();

		if (hasHandlers)
			this.onHandlerCleared.invoke(invocationList ?? this.getInvocationList());

		return this;
	}

	/**
	 * Retourne la liste des callbacks actuellement enregistrés, dans leur
	 * ordre d'enregistrement.
	 *
	 * Équivalent de
	 * [`Delegate.GetInvocationList()`](https://learn.microsoft.com/fr-fr/dotnet/api/system.delegate.getinvocationlist)
	 * en C#.
	 *
	 * @returns Un tableau contenant tous les callbacks enregistrés.
	 *
	 * @see {@link https://learn.microsoft.com/fr-fr/dotnet/api/system.delegate.getinvocationlist | Delegate.GetInvocationList() — C#}
	 */
	getInvocationList(): T[] {
		return pipe(
			this.#_callbacks.values(),
			Array.from,
			(callbacks: IEventData<TArgs, T>[]) => callbacks.map(x => x.callback),
		);
	}

	/**
	 * Génère une clé unique pour un nouveau callback.
	 *
	 * Utilise une chaîne aléatoire de longueur variable entre 5 et 20
	 * caractères. En cas de collision, rappelle récursivement jusqu'à
	 * obtenir une clé libre.
	 *
	 * @returns Une clé unique sous forme de chaîne de caractères.
	 * @private
	 */
	#_generateKey(): string {
		const g_key = Random.randomString(toUint(Random.intRange(Int[5], Int[20])));

		if (this.#_callbacks.has(g_key)) return this.#_generateKey();
		else return g_key;
	}
}
