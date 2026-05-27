import { Func, Nullable } from '@rotomeca/utils';
import { EventHandler } from '../classes/EventHandler';
import { CircularEventHandler } from '../classes/CircularEventHandler';

/**
 * Clé Symbol utilisée pour stocker la Map de cache des listeners sur l'instance cible.
 * @internal
 */
const listenerCacheKey = Symbol('listenerCache');

/**
 * Options internes passées à la fonction helper `_get`.
 * @template T Type de l'instance cible.
 * @template TArgs Tuple des types d'arguments du callback.
 * @template TCallback Type de la fonction de callback de l'événement.
 */
type GetListenerOptions<
	T,
	TArgs extends any[] = any[],
	TCallback extends Func<TArgs> = Func<TArgs>,
> = {
	/** L'instance de la classe contenant l'accesseur décoré. */
	target: T;
	/** La clé unique identifiant la propriété de l'événement dans le cache. */
	listenerCacheKey: symbol;
	/** Fonction d'initialisation optionnelle exécutée à la création de l'événement. */
	initializator?: Nullable<CallbackInitializer<TArgs, TCallback, T>>;
	/** Si true, instancie un `CircularEventHandler`. */
	circular?: boolean;
};

/**
 * Définit la signature de la fonction d'initialisation d'un événement.
 * Permet de configurer l'événement (ex: ajouter des abonnés par défaut) lors de sa création.
 *
 * @template TArgs Tuple des types d'arguments du callback.
 * @template TCallback Signature de la fonction callback de l'événement.
 * @template This Type de l'instance de la classe parente.
 * @param event L'instance de l'événement nouvellement créée.
 * @param instance L'instance de la classe parente.
 */
export type CallbackInitializer<
	TArgs extends any[] = any[],
	TCallback extends Func<TArgs> = Func<TArgs>,
	This = any,
> = (event: EventHandler<TArgs, TCallback>, instance: This) => void;

/**
 * Options de configuration pour le décorateur {@link Listener}.
 */
export type ListenerOptions = {
	/**
	 * Si `true` (par défaut), l'événement n'est instancié que lors du premier accès (getter).
	 * Si `false`, l'événement est instancié immédiatement lors de l'initialisation de la classe parente.
	 * @default true
	 */
	lazy?: boolean;
	/**
	 * Si `true`, crée une instance de {@link CircularEventHandler} au lieu de {@link EventHandler}.
	 * Utile pour les topologies d'événements où chaque callback reçoit le résultat du précédent.
	 * @default false
	 */
	circular?: boolean;
};

/**
 * Décorateur d'accesseur automatique pour gérer des instances de {@link EventHandler}.
 *
 * Ce décorateur transforme un accesseur (auto-accessor) en une propriété gérée,
 * assurant une instanciation unique (Singleton par propriété) et une gestion du cache.
 * Il empêche également l'écrasement accidentel de l'événement via le setter.
 *
 * @template TArgs Tuple des types d'arguments du callback.
 * @template TCallback Signature de la fonction callback de l'événement.
 * @template This Type de l'instance de la classe parente.
 *
 * @param initializator - (Optionnel) Fonction exécutée une seule fois à la création de l'événement pour le configurer.
 * @param options - (Optionnel) Configuration du comportement du listener (lazy loading, type d'événement).
 *
 * @returns Le décorateur d'accesseur de classe conforme à la norme ES Decorators (Stage 3).
 *
 * @throws {Error} Si une tentative d'assignation (setter) est effectuée sur la propriété décorée.
 *
 * @example
 * ```ts
 * class MyComponent {
 *   @Listener((evt, instance) => evt.add('handler', instance.handleAction))
 *   accessor onAction: EventHandler<[string], (val: string) => void>;
 *
 *   private handleAction(val: string) {
 *     console.log(val);
 *   }
 * }
 * ```
 *
 * @see {@link NoInitListener} pour omettre l'initialisation tout en passant des options
 */
export function Listener<
	TArgs extends any[] = any[],
	TCallback extends Func<TArgs> = Func<TArgs>,
	This = any,
>(
	initializator?: Nullable<CallbackInitializer<TArgs, TCallback, This>>,
	options?: ListenerOptions,
) {
	const { circular = false, lazy = true } = options ?? {};

	return function (
		_target: ClassAccessorDecoratorTarget<This, EventHandler<TArgs, TCallback>>,
		context: ClassAccessorDecoratorContext<
			This,
			EventHandler<TArgs, TCallback>
		>,
	): ClassAccessorDecoratorResult<This, EventHandler<TArgs, TCallback>> {
		const methodName = String(context.name);
		const listenerCacheKey = Symbol(`listener_${methodName}`);
		const args = { listenerCacheKey, circular, initializator };

		if (!lazy) {
			context.addInitializer(function (this: This) {
				_get<This, TArgs, TCallback>({ target: this, ...args });
			});
		}

		return {
			get(this: This): EventHandler<TArgs, TCallback> {
				return _get<This, TArgs, TCallback>({ target: this, ...args });
			},
			set(_value) {
				throw new Error(
					`Cannot set decorated accessor ${String(context.name)}. It is managed by the @Listener decorator.`,
				);
			},
		};
	};
}

/**
 * Helper interne pour récupérer ou créer l'instance de l'événement.
 * Implémente le principe DRY pour le chargement immédiat (eager) et différé (lazy).
 *
 * @template T Type de l'instance cible.
 * @template TArgs Tuple des types d'arguments du callback.
 * @template TCallback Type du callback de l'événement.
 * @param options Objet contenant les paramètres de récupération/création.
 * @returns L'instance de l'événement stockée dans le cache.
 * @throws {Error} Si l'initializator a échoué.
 * @internal
 */
function _get<
	T,
	TArgs extends any[] = any[],
	TCallback extends Func<TArgs> = Func<TArgs>,
>(
	options: GetListenerOptions<T, TArgs, TCallback>,
): EventHandler<TArgs, TCallback> {
	const { target: self, listenerCacheKey, circular, initializator } = options;

	const cache = ((self as any)[listenerCacheKey] ??= new Map<
		symbol,
		EventHandler<TArgs, TCallback>
	>());

	if (!cache.has(listenerCacheKey)) {
		const event = circular
			? (new CircularEventHandler() as unknown as EventHandler<
					TArgs,
					TCallback
				>)
			: new EventHandler<TArgs, TCallback>();

		if (initializator && initializator.name !== NoInitListener.name) {
			try {
				initializator(event, self);
			} catch (error) {
				console.error(
					'@Listener',
					`Failed to initialize event for ${String(listenerCacheKey)}`,
					error,
					options,
				);

				throw error;
			}
		}

		cache.set(listenerCacheKey, event);
	}

	return cache.get(listenerCacheKey)!;
}

/**
 * Fonction "No-op" (No Operation) servant de placeholder sémantique.
 *
 * Utilisez cette fonction comme premier argument du décorateur {@link Listener}
 * lorsque vous n'avez aucune logique d'initialisation à fournir, mais que vous
 * devez passer un objet d'options en second argument.
 *
 * Cela améliore la lisibilité du code et l'intention par rapport à l'utilisation
 * de `null` ou `() => {}`.
 *
 * @example
 * ```ts
 * class GraphNode {
 *   // On souhaite activer le mode 'circular', sans logique d'initialisation spécifique.
 *   @Listener(NoInitListener, { circular: true })
 *   accessor links: EventHandler<[LinkArgs], LinkCallback>;
 * }
 * ```
 *
 * @see {@link Listener}
 */
export function NoInitListener() {}
