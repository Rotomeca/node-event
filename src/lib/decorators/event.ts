import { Func, MayBe, Nullable, Optional } from '@rotomeca/utils';
import { EventDelegate } from '../classes/EventHandler';
import { IEventHandler } from '../interfaces/IEventHandler';
import { CircularEventDelegate } from '../classes/CircularEventHandler';

/** Clé de symbole globale utilisée pour stocker le cache des événements sur l'instance. */
const listenersCacheKey = Symbol('globalCache');

/**
 * Enrichit le type `T` avec le cache interne des événements décorés.
 *
 * Utilisé en interne pour accéder au cache partagé sur l'instance cible
 * sans exposer la propriété dans l'API publique de la classe.
 *
 * @typeParam T - Type de l'instance cible.
 * @internal
 */
type WithCache<T> = T & {
	[listenersCacheKey]: Optional<Map<symbol, object>>;
};

/**
 * Signature générique commune aux initialisateurs d'événements décorés.
 *
 * Abstraction interne utilisée par {@link _eventDecorator} et {@link _get}
 * pour accepter indifféremment un {@link CallbackInitializator} ou un
 * {@link CircularCallbackInitializator} sans recourir à des casts `as any`.
 *
 * @typeParam TEventType - Type de l'instance d'événement reçue par l'initialisateur.
 * @typeParam This - Type de l'instance de la classe parente.
 *
 * @internal
 */
type AnyInitializator<TEventType extends Object, This> = MayBe<
	(event: TEventType, instance: This) => void
>;

/**
 * Paramètres internes passés à {@link _get} lors de la récupération
 * ou de la création d'un événement.
 *
 * @typeParam T - Type de l'instance cible.
 * @typeParam TCallback - Type du callback de l'événement, doit étendre {@link Func}.
 *
 * @internal
 */
export type EventGetOption<T, TCallback extends Func> = {
	/** Fonction d'initialisation optionnelle appelée à la création de l'événement. */
	initializator: AnyInitializator<IEventHandler, T>;
	/** Instance cible enrichie du cache. */
	target: WithCache<T>;
	/** Clé de symbole unique identifiant l'événement dans le cache. */
	listenerCacheKey: symbol;
	/** Callback appelé si l'initialisation lève une erreur. */
	onError: OnErrorCallback<T, TCallback>;
};

/**
 * Objet transmis au callback {@link OnErrorCallback} lorsqu'une erreur
 * survient pendant l'initialisation d'un événement décoré.
 *
 * Contient toutes les informations contextuelles nécessaires au diagnostic,
 * à l'exception du callback `onError` lui-même pour éviter la récursion.
 *
 * @typeParam T - Type de l'instance cible.
 * @typeParam TCallback - Type du callback de l'événement, doit étendre {@link Func}.
 *
 * @see {@link OnErrorCallback}
 */
export type DecoratorEventErrorObject<T, TCallback extends Func> = Omit<
	EventGetOption<T, TCallback>,
	'onError'
> & {
	/** L'erreur interceptée lors de l'initialisation. */
	error: Error;
};

/**
 * Signature du callback appelé lorsqu'une erreur survient pendant
 * l'initialisation d'un événement décoré par {@link event} ou {@link circularEvent}.
 *
 * @typeParam T - Type de l'instance cible.
 * @typeParam TCallback - Type du callback de l'événement, doit étendre {@link Func}.
 *
 * @param data - Objet contextuel décrivant l'erreur et son environnement.
 *
 * @example
 * ```ts
 * const onError: OnErrorCallback<MyClass, () => void> = ({ error, listenerCacheKey }) => {
 *   console.error(`Erreur sur ${String(listenerCacheKey)} :`, error.message);
 * };
 *
 * class MyClass {
 *   @event(null, { onError })
 *   accessor onClick: EventDelegate<() => void>;
 * }
 * ```
 *
 * @see {@link DecoratorEventErrorObject}
 * @see {@link ListenerDefaultOptions.onError}
 */
export type OnErrorCallback<T, TCallback extends Func> = (
	data: DecoratorEventErrorObject<T, TCallback>,
) => void;

/**
 * Signature de la fonction d'initialisation d'un événement décoré par {@link event}.
 *
 * Appelée une seule fois à la création de l'événement — lors du premier accès
 * en mode `lazy` (défaut), ou lors de l'initialisation de la classe en mode eager.
 * Permet de configurer l'événement à sa création, par exemple en y ajoutant
 * des abonnés par défaut.
 *
 * @typeParam TCallback - Signature du callback de l'événement.
 * @typeParam This - Type de l'instance de la classe parente.
 *
 * @param event - L'instance de {@link EventDelegate} nouvellement créée.
 * @param instance - L'instance de la classe parente propriétaire de l'événement.
 *
 * @example
 * ```ts
 * const init: CallbackInitializator<() => void, MyClass> = (event, instance) => {
 *   event.add('default', () => console.log('déclenché depuis', instance));
 * };
 *
 * class MyClass {
 *   @event(init)
 *   accessor onClick: EventDelegate<() => void>;
 * }
 * ```
 *
 * @see {@link event}
 * @see {@link CircularCallbackInitializator} pour la variante circulaire
 * @see {@link NoInitEvent} pour une fonction de remplacement sans logique
 */
export type CallbackInitializator<TCallback extends Func, This> = (
	event: EventDelegate<TCallback>,
	instance: This,
) => void;

/**
 * Signature de la fonction d'initialisation d'un événement circulaire décoré
 * par {@link circularEvent}.
 *
 * Équivalent de {@link CallbackInitializator} pour {@link circularEvent} —
 * reçoit un {@link CircularEventDelegate} à la place d'un {@link EventDelegate}.
 * Appelée une seule fois à la création de l'événement.
 *
 * @typeParam TRecord - Type du record propagé entre les callbacks.
 *                      Doit étendre `Record<string, unknown>`.
 * @typeParam This - Type de l'instance de la classe parente.
 *
 * @param event - L'instance de {@link CircularEventDelegate} nouvellement créée.
 * @param instance - L'instance de la classe parente propriétaire de l'événement.
 *
 * @example
 * ```ts
 * const init: CircularCallbackInitializator<{ count: number }, MyClass> =
 *   (event, instance) => {
 *     event.add('default', ({ count }) => ({ count: count + instance.step }));
 *   };
 *
 * class MyClass {
 *   step = 1;
 *
 *   @circularEvent(init)
 *   accessor onProcess: CircularEventDelegate<{ count: number }>;
 * }
 * ```
 *
 * @see {@link circularEvent}
 * @see {@link CallbackInitializator} pour la variante standard
 */
export type CircularCallbackInitializator<
	TRecord extends Record<string, unknown>,
	This,
> = (event: CircularEventDelegate<TRecord>, instance: This) => void;

/**
 * Options de configuration publiques pour les décorateurs {@link event}
 * et {@link circularEvent}.
 *
 * Tous les champs sont optionnels — des valeurs par défaut sont appliquées
 * dans chaque décorateur si non fournis.
 *
 * @typeParam TCallback - Type du callback de l'événement, doit étendre {@link Func}.
 * @typeParam T - Type de la classe parente. Par défaut `any`.
 *
 * @see {@link ListenerDefaultOptionsDefined} pour la version avec champs requis
 */
export type ListenerDefaultOptions<TCallback extends Func, T = any> = {
	/**
	 * Si `true` (par défaut), l'événement n'est instancié que lors du premier accès au getter.
	 *
	 * Si `false`, l'événement est instancié immédiatement lors de l'initialisation
	 * de la classe parente via `context.addInitializer`.
	 *
	 * @default true
	 */
	lazy?: boolean;

	/**
	 * Callback appelé si la fonction d'initialisation lève une erreur.
	 *
	 * Par défaut, loggue l'erreur via `console.error` avec le préfixe du décorateur.
	 *
	 * @see {@link OnErrorCallback}
	 */
	onError?: OnErrorCallback<T, TCallback>;
};

/**
 * Version résolue de {@link ListenerDefaultOptions} avec tous les champs requis.
 *
 * Utilisée en interne par {@link _eventDecorator} après application des valeurs
 * par défaut dans {@link event} ou {@link circularEvent}, garantissant que
 * `lazy` et `onError` sont toujours définis.
 *
 * @typeParam TCallback - Type du callback de l'événement, doit étendre {@link Func}.
 * @typeParam T - Type de la classe parente. Par défaut `any`.
 *
 * @internal
 * @see {@link ListenerDefaultOptions} pour la version publique avec champs optionnels
 */
export type ListenerDefaultOptionsDefined<TCallback extends Func, T = any> = {
	/**
	 * Si `true`, l'événement n'est instancié que lors du premier accès au getter.
	 * Si `false`, l'événement est instancié lors de l'initialisation de la classe.
	 *
	 * La valeur par défaut (`true`) est définie dans {@link event} et {@link circularEvent}.
	 */
	lazy: boolean;

	/**
	 * Callback appelé si la fonction d'initialisation lève une erreur.
	 *
	 * @see {@link OnErrorCallback}
	 */
	onError: OnErrorCallback<T, TCallback>;
};

/**
 * Décorateur d'accesseur qui transforme une propriété de classe en
 * {@link EventDelegate} géré automatiquement.
 *
 * Inspiré du mot-clé
 * [`event`](https://learn.microsoft.com/fr-fr/dotnet/csharp/programming-guide/events/)
 * de C#, ce décorateur encapsule la création, le cycle de vie et la mise en cache
 * d'un {@link EventDelegate} sur l'instance. La propriété décorée devient
 * accessible en lecture seule — toute tentative d'affectation lève une erreur.
 *
 * Le cache est partagé sur l'instance via un `Symbol` non énumérable,
 * garantissant l'isolation entre les différents événements d'une même classe.
 *
 * @typeParam TCallback - Type du callback de l'événement. Doit étendre {@link Func}.
 * @typeParam This - Type de la classe parente. Par défaut `any`.
 *
 * @param initializator - Fonction appelée à la création de l'événement pour le
 *                        configurer (abonnés par défaut, etc.).
 *                        Passer {@link NoInitEvent} si aucune logique n'est requise
 *                        mais qu'un objet `options` doit être fourni.
 *                        Passer `null` ou omettre pour ne rien faire.
 * @param options - Options de configuration. Voir {@link ListenerDefaultOptions}.
 *
 * @example
 * ```ts
 * type ClickCallback = (e: MouseEvent) => void;
 *
 * class Button {
 *   // Lazy par défaut — créé au premier accès
 *   @event<ClickCallback>()
 *   accessor onClick: EventDelegate<ClickCallback>;
 *
 *   // Eager — créé dès l'instanciation de Button
 *   @event<ClickCallback>(null, { lazy: false })
 *   accessor onDoubleClick: EventDelegate<ClickCallback>;
 *
 *   // Avec initialisation — abonné ajouté à la création
 *   @event<ClickCallback>((ev, instance) => {
 *     ev.add('default', (e) => instance.handleClick(e));
 *   })
 *   accessor onContextMenu: EventDelegate<ClickCallback>;
 * }
 *
 * const btn = new Button();
 * btn.onClick.add('logger', (e) => console.log(e.clientX));
 * btn.onClick.invoke(new MouseEvent('click'));
 * ```
 *
 * @see {@link circularEvent} pour la variante circulaire
 * @see {@link NoInitEvent} pour omettre l'initialisation tout en passant des options
 * @see {@link CallbackInitializator} pour la signature de l'initialisateur
 * @see {@link ListenerDefaultOptions} pour les options disponibles
 * @see {@link https://learn.microsoft.com/fr-fr/dotnet/csharp/programming-guide/events/ | Événements — Guide C#}
 */
export function event<TCallback extends Func, This = any>(
	initializator?: Nullable<CallbackInitializator<TCallback, This>>,
	options?: ListenerDefaultOptions<TCallback, This>,
) {
	const {
		lazy = true,
		onError = (data: DecoratorEventErrorObject<This, TCallback>) => {
			console.error(
				'@event',
				`Failed to initialize event for ${String(data.listenerCacheKey)}`,
				data,
			);
		},
	} = options ?? {};

	return function (
		_target: ClassAccessorDecoratorTarget<This, EventDelegate<TCallback>>,
		context: ClassAccessorDecoratorContext<This, EventDelegate<TCallback>>,
	): ClassAccessorDecoratorResult<This, EventDelegate<TCallback>> {
		return _eventDecorator<EventDelegate<TCallback>, This>(
			initializator,
			{ lazy, onError },
			_target,
			context,
		);
	};
}

/**
 * Décorateur d'accesseur qui transforme une propriété de classe en
 * {@link CircularEventDelegate} géré automatiquement.
 *
 * Variante circulaire de {@link event} — chaque callback reçoit et transforme
 * le résultat du précédent, selon le pattern Middleware inspiré d'ASP.NET Core.
 * La propriété décorée devient accessible en lecture seule — toute tentative
 * d'affectation lève une erreur.
 *
 * Le cache est partagé sur l'instance via un `Symbol` non énumérable,
 * garantissant l'isolation entre les différents événements d'une même classe.
 *
 * @typeParam TRecord - Type du record propagé entre les callbacks.
 *                      Doit étendre `Record<string, unknown>`.
 *                      Par défaut `Record<string, unknown>`.
 * @typeParam This - Type de la classe parente. Par défaut `any`.
 *
 * @param initializator - Fonction appelée à la création de l'événement pour le
 *                        configurer (abonnés par défaut, etc.).
 *                        Passer {@link NoInitEvent} si aucune logique n'est requise
 *                        mais qu'un objet `options` doit être fourni.
 *                        Passer `null` ou omettre pour ne rien faire.
 * @param options - Options de configuration. Voir {@link ListenerDefaultOptions}.
 *
 * @example
 * ```ts
 * class Pipeline {
 *   @circularEvent<{ value: number }>((ev) => {
 *     ev.add('clamp', ({ value }) => ({ value: Math.max(0, value) }));
 *   })
 *   accessor onProcess: CircularEventDelegate<{ value: number }>;
 * }
 *
 * const p = new Pipeline();
 * p.onProcess.add('double', ({ value }) => ({ value: value * 2 }));
 *
 * const result = p.onProcess.invoke({ value: -3 });
 * // result → { type: 'record', value: { value: 0 } }  (clamp avant double)
 * ```
 *
 * @see {@link event} pour la variante standard
 * @see {@link NoInitEvent} pour omettre l'initialisation tout en passant des options
 * @see {@link CircularCallbackInitializator} pour la signature de l'initialisateur
 * @see {@link ListenerDefaultOptions} pour les options disponibles
 * @see {@link https://learn.microsoft.com/fr-fr/aspnet/core/fundamentals/middleware | Middleware — ASP.NET Core}
 */
export function circularEvent<
	TRecord extends Record<string, unknown> = Record<string, unknown>,
	This = any,
>(
	initializator?: Nullable<CircularCallbackInitializator<TRecord, This>>,
	options?: ListenerDefaultOptions<(params: TRecord) => TRecord, This>,
) {
	const {
		lazy = true,
		onError = (
			data: DecoratorEventErrorObject<This, (params: TRecord) => TRecord>,
		) => {
			console.error(
				'@circularEvent',
				`Failed to initialize event for ${String(data.listenerCacheKey)}`,
				data,
			);
		},
	} = options ?? {};

	return function (
		_target: ClassAccessorDecoratorTarget<This, CircularEventDelegate<TRecord>>,
		context: ClassAccessorDecoratorContext<
			This,
			CircularEventDelegate<TRecord>
		>,
	): ClassAccessorDecoratorResult<This, CircularEventDelegate<TRecord>> {
		return _eventDecorator<CircularEventDelegate<TRecord>, This>(
			initializator,
			{ lazy, onError },
			_target,
			context,
			() => new CircularEventDelegate<TRecord>(),
		);
	};
}

/**
 * Implémentation interne partagée par {@link event} et {@link circularEvent}.
 *
 * Sépare la logique de construction du décorateur (résolution des options) de
 * la logique de la fabrique retournée (`get` / `set` / `addInitializer`).
 * Accepte un `creator` optionnel pour instancier le type d'événement souhaité —
 * par défaut un {@link EventDelegate}.
 *
 * @typeParam TEventType - Type concret de l'événement géré, doit étendre {@link IEventHandler}.
 * @typeParam This - Type de la classe parente.
 *
 * @param initializator - Fonction d'initialisation ou `null`.
 * @param options - Options résolues — tous les champs sont garantis définis.
 * @param _target - Descripteur d'accesseur original (non utilisé).
 * @param context - Contexte du décorateur, fournit le nom de la propriété et
 *                  la méthode `addInitializer`.
 * @param creator - Fabrique optionnelle retournant une instance de `TEventType`.
 *                  Si absent, un {@link EventDelegate} est instancié par défaut.
 * @returns Un {@link ClassAccessorDecoratorResult} avec `get` et `set` surchargés.
 *
 * @internal
 */
function _eventDecorator<TEventType extends object, This = any>(
	initializator: AnyInitializator<TEventType, This>,
	options: ListenerDefaultOptionsDefined<Func, This>,
	_target: ClassAccessorDecoratorTarget<This, TEventType>,
	context: ClassAccessorDecoratorContext<This, TEventType>,
	creator?: () => TEventType,
): ClassAccessorDecoratorResult<This, TEventType> {
	const methodName = String(context.name);
	const listenerCacheKey = Symbol(`listener_${methodName}`);
	const args = { listenerCacheKey, initializator, onError: options.onError };

	if (!options.lazy) {
		context.addInitializer(function (this: This) {
			const params = {
				target: this as WithCache<This>,
				...args,
			};
			_get<This, TEventType>(params as any, creator);
		});
	}

	return {
		get(this: This): TEventType {
			const params = {
				target: this as WithCache<This>,
				...args,
			};
			return _get<This, TEventType>(params as any, creator);
		},
		set(_value) {
			throw new Error(
				`Cannot set decorated accessor ${String(context.name)}. It is managed by the @event decorator.`,
			);
		},
	};
}

/**
 * Récupère l'instance de `TEventType` associée à une clé dans le cache
 * de l'instance cible, en la créant si elle n'existe pas encore.
 *
 * Initialise le cache (`Map`) sur l'instance si nécessaire via l'opérateur `??=`,
 * puis crée et configure l'événement lors du premier accès pour la clé donnée
 * en appelant `creator` si fourni, ou en instanciant un {@link EventDelegate} par défaut.
 *
 * Si l'initialisation échoue, {@link EventGetOption.onError} est appelé avec
 * le contexte de l'erreur — l'événement est tout de même mis en cache dans son
 * état non initialisé pour éviter de répéter l'erreur à chaque accès.
 *
 * @typeParam T - Type de l'instance cible.
 * @typeParam TEventType - Type concret de l'événement, doit étendre {@link IEventHandler}.
 *
 * @param options - Paramètres de récupération. Voir {@link EventGetOption}.
 * @param creator - Fabrique optionnelle retournant une instance de `TEventType`.
 *                  Si absent, un {@link EventDelegate} est instancié par défaut.
 * @returns L'instance de `TEventType` associée à la clé.
 *
 * @internal
 */
function _get<T, TEventType extends object>(
	options: EventGetOption<T, Func>,
	creator?: () => TEventType,
): TEventType {
	const { target: self, initializator, listenerCacheKey, onError } = options;

	const cache = (self[listenersCacheKey] ??= new Map<symbol, IEventHandler>());

	if (!cache.has(listenerCacheKey)) {
		const event = creator
			? creator()
			: (new EventDelegate() as unknown as TEventType);

		if (initializator && initializator !== NoInitEvent) {
			try {
				initializator(event as IEventHandler, self);
			} catch (e) {
				const error: Error =
					e instanceof Error
						? e
						: new Error(
								`Failed to initialize event for ${String(listenerCacheKey)}`,
								{ cause: e },
							);
				onError({ target: self, initializator, listenerCacheKey, error });
			}
		}

		cache.set(listenerCacheKey, event);
	}

	return cache.get(listenerCacheKey) as TEventType;
}

/**
 * Fonction _no-op_ servant de placeholder sémantique pour les décorateurs
 * {@link event} et {@link circularEvent}.
 *
 * À utiliser comme premier argument lorsqu'aucune logique d'initialisation
 * n'est requise, mais qu'un objet `options` doit être fourni en second argument.
 * Préférable à `null` ou `() => {}` pour exprimer explicitement l'intention.
 *
 * La détection repose sur une **comparaison par référence** (`initializator !== NoInitEvent`)
 * et non sur le nom de la fonction — le comportement est donc stable après minification.
 *
 * @example
 * ```ts
 * class Button {
 *   // Aucune initialisation, mais on veut le mode eager
 *   @event(NoInitEvent, { lazy: false })
 *   accessor onClick: EventDelegate<() => void>;
 *
 *   // Même chose pour un événement circulaire
 *   @circularEvent(NoInitEvent, { lazy: false })
 *   accessor onProcess: CircularEventDelegate<{ value: number }>;
 * }
 * ```
 *
 * @see {@link event}
 * @see {@link circularEvent}
 * @see {@link CallbackInitializator} pour fournir une logique d'initialisation
 */
export function NoInitEvent() {}
